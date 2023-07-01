/* eslint-disable no-prototype-builtins */
import TelegramBot from 'node-telegram-bot-api';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import express from 'express'
import { Session } from './session.js'
import * as steps from './steps.js'
import moment from 'moment'

const token = process.env.TOKEN;
const url = process.env.URL
const port = process.env.PORT
const dbPath = process.env.DB_PATH || "./re-prg/site/estates.db";
const db2Path = process.env.DB2_PATH || "./estates-bot.db";
const defaultTimeHours = "6"

// Telegram Bot Initialization
const bot = createBot()
const { db, dbqueries } = await dbInit()

async function dbInit() {
    try {
        const db = await open({ filename: dbPath, driver: sqlite3.Database });
        const dbqueries = await open({ filename: db2Path, driver: sqlite3.Database });
        await dbqueries.run(`CREATE TABLE IF NOT EXISTS queries (
            user_id INTEGER,
            max_price INTEGER,
            min_price INTEGER,
            max_size INTEGER,
            min_size INTEGER,
            disposition TEXT,
            type TEXT,
            is_ready INTEGER
          )`)
        return { db, dbqueries }
    } catch (e) {
        console.error([e, dbPath, db2Path]);
        throw e;
    }
}

function createBot() {
    if (process.env.POLLING == "true") {
        return new TelegramBot(token, { polling: true })
    }
    const bot = new TelegramBot(token);
    bot.setWebHook(`${url}/bot${token}`);

    const app = express();

    // parse the updates to JSON
    app.use(express.json());

    // We are receiving updates at the route below!
    app.get("/bot/health", (req, res) => {
        res.sendStatus(200);
    })
    app.post(`/bot${token}`, (req, res) => {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    });

    // Start Express Server
    app.listen(port, () => {
        console.log(`Express server is listening on ${port}`);
    });

    return bot;
}

const sessions = new Session(dbqueries)
const handlers = new Map()
const s = [
    new steps.Start(bot, sessions),
    new steps.Buy(bot, sessions),
    new steps.Rent(bot, sessions),
    new steps.Cancel(bot, sessions),
    new steps.Subscribe(bot, sessions, processQueries),
    new steps.Unsubscribe(bot, sessions),
    new steps.SetFilter(bot, sessions)]
s.forEach(x => handlers.set(x.name(), x))


bot.on("message", async (msg) => {
    let messageText = msg.text;
    console.log(`calling ${messageText}`)
    try {
        if (handlers.has(messageText)) {
            await handlers.get(messageText).execute(msg)
        } else {
            await handlers.get("*").execute(msg)
        }
    } catch (e) {
        console.error(e)
    }
})

async function runJob() {
    // Job running every hour
    setTimeout(runJob, 10 * defaultTimeHours); // switch back to hour
    console.log("Run job!")
    // Retrieve queries from the database
    processQueries();
    await sessions.flushSessionsToDB()
}

const prevRun = (Math.floor(moment().hours() / defaultTimeHours)) * defaultTimeHours
let pause = defaultTimeHours * 60 * 60 * 1000 - (moment() - moment().set("hours", prevRun).set("minutes", 0))
console.log(`Job will be run in ${pause} milliseconds`)
pause = 1000
setTimeout(runJob, pause)


async function processQueries(userId, lastHours) {
    if (!lastHours) {
        lastHours = defaultTimeHours
    }
    const queries = await dbqueries.all('SELECT user_id, max_price, min_price, max_size, min_size, type FROM queries WHERE (user_id=?1 OR ?1 IS NULL) AND is_ready=1 ', [userId]);

    const q = {};
    queries.forEach((query) => {
        const { user_id, max_price, min_price, max_size, min_size, type } = query;
        const key = [min_size, max_size, min_price, max_price, type];
        if (!q[key]) {
            q[key] = [user_id];
        } else {
            q[key].push(user_id);
        }
    });

    const tasks = Object.keys(q).map(async k => {
        const users = q[k];
        const [min_size, max_size, min_price, max_price, type] = k.split(",").map(x => x === '' ? null : x)
        const params = [`-${lastHours} hour`, min_size ?? 0, max_size ?? 999, min_price ?? 0, max_price ?? 999999999, null]
        const sql = getQuery(type)
        console.log([sql, users, params])
        const rows = await db.all(sql, params);
        console.log(`found ${rows.length} rows`)
        //TODO send group of user
        await Promise.all(users.map(async u => {
            const filterName = `${printFilter("min_size", min_size)}, ${printFilter("max_size", max_size)}}, ${printFilter("min_price", min_price)}, ${printFilter("max_price", max_price)}`
            await bot.sendMessage(u, `results according your filter(${filterName}) for the last ${lastHours} hours:`)
            if (rows.length > 10) {
                bot.sendMessage(u, rows.map(r => r.url).join(" /n"))
            } else {
                rows.forEach(r => bot.sendMessage(u, r.url))
            }
        }));
    })

    await Promise.all(tasks);
}

function printFilter(name, value) {
    return `${name}: ${value ?? 'Not Set'}`;
}

function getQuery(type) {
    return `
SELECT e.url
FROM   "estates_agg" e
       JOIN (SELECT Min(createdon) createdOn,
                    id
             FROM   "${(type == "buy" ? "estates_agg" : "estates_rent_agg")}"
             GROUP  BY id)q
         ON q.id = e.id
WHERE  strftime('%Y-%m-%d %H:%M:%S',q.createdon) > (SELECT Datetime('now', ?1))
AND e.size>=?2 AND e.size<=?3 AND e.price>=?4 AND  e.price<=?5 AND (?6 IS NULL OR e.disposition=?6)
ORDER  BY e.createdon desc
`
}