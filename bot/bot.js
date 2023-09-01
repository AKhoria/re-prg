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
const defaultTimeHours = "3"

// Telegram Bot Initialization
const bot = createBot()
const { db, dbqueries } = await dbInit()

async function dbInit() {
    try {
        const db = await open({ filename: dbPath, driver: sqlite3.Database, mode: sqlite3.OPEN_READONLY });
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
        await dbqueries.run(`CREATE TABLE IF NOT EXISTS messages (
            user_id INTEGER,
            message TEXT
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
    setTimeout(runJob, 60 * 60 * 1000 * defaultTimeHours);
    console.log("Run job!")
    // Retrieve queries from the database
    try {
        await processQueries();
        await sessions.flushSessionsToDB()
        await sendMessages()
    } catch (e) {
        console.error(e)
    }
}

const prevRun = (Math.floor(moment().hours() / defaultTimeHours)) * defaultTimeHours
let pause = defaultTimeHours * 60 * 60 * 1000 - (moment() - moment().set("hours", prevRun).set("minutes", 0))
console.log(`Job will be run in ${pause} milliseconds`)
setTimeout(runJob, pause + 1000 * 60 * 5) // start at x*defaultTimeHours + 5min

async function sendMessages() {
    const msgs = await dbqueries.all('SELECT user_id, message FROM messages');
    const users = await dbqueries.all('SELECT user_id FROM queries');
    const userSet = new Set(users.map(x => x.user_id))
    await Promise.all(msgs.map(async m => {
        await Promise.all([...userSet].map(async u => {
            await bot.sendMessage(u, m.message)
        }))
    }))
    await dbqueries.run("DELETE from messages")
}

async function processQueries(userId, lastHours) {
    if (!lastHours) {
        lastHours = defaultTimeHours
    }
    const queries = await dbqueries.all('SELECT user_id, max_price, min_price, max_size, min_size, disposition, type FROM queries WHERE (user_id=?1 OR ?1 IS NULL) AND is_ready=1 ', [userId]);

    const q = {};
    queries.forEach((query) => {
        const { user_id, max_price, min_price, max_size, min_size, disposition, type } = query;
        const key = [min_size, max_size, min_price, max_price, disposition, type].join("|");
        if (!q[key]) {
            q[key] = [user_id];
        } else {
            q[key].push(user_id);
        }
    });

    const tasks = Object.keys(q).map(async strKey => {
        const users = q[strKey];
        const [min_size, max_size, min_price, max_price, disposition, type] = strKey.split("|").map(x => x === '' ? null : x)
        const params = [`-${lastHours} hour`, min_size ?? 0, max_size ?? 999, min_price ?? 0, max_price ?? 999999999, ...(disposition?.split(",") ?? [])]
        const sql = getQuery(type, disposition?.split(",").length ?? 0)
        console.log([sql, users, params])
        const rows = await db.all(sql, params);
        console.log(`found ${rows.length} rows`)
        //TODO send group of user
        await Promise.all(users.map(async u => {
            if (rows.length != 0) {
                try {
                    const filterName = `${printFilter("min_size", min_size)}, ${printFilter("max_size", max_size)}, ${printFilter("min_price", min_price)}, ${printFilter("max_price", max_price)}, ${printFilter("disposition", disposition)}`
                    await bot.sendMessage(u, `Results according your filter(${filterName}) for the last ${lastHours} hours:`)
                    if (rows.length > 10) {
                        let text = ""
                        for (const r of rows) {
                            const link = `<a href='${r.url}'>${r.text} (${r.price})</a>`
                            if ((`${text} \n ${link}`).length > 4096) {
                                await bot.sendMessage(u, text, { parse_mode: "HTML" })
                                text = link
                            } else {
                                text = `${text} \n ${link}`
                            }
                        }
                        if (text) {
                            await bot.sendMessage(u, text, { parse_mode: "HTML" })
                        }
                    } else {
                        await Promise.all(rows.map(async r => await bot.sendMessage(u, `<a href='${r.url}'>${r.text} (${r.price})</a>`, { parse_mode: "HTML" })))
                    }
                } catch (e) {
                    console.error(e)
                }
            }
        }));
    })

    await Promise.all(tasks);
}

function printFilter(name, value) {
    return `${name}: ${value ?? 'Not Set'}`;
}

function getQuery(type, dispLen) {
    let params = []
    for (let i = 6; i < (dispLen + 6); i++) {
        params.push(i)
    }
    let dispFilter = 
        params.length == 0 ? 
        "1==1" : 
        `e.disposition in (${params.map((value) => `$${value + 1}`).join(',')})`
    return `
SELECT e.url, e.text, e.price
FROM   "${(type == "buy" ? "estates_agg" : "estates_rent_agg")}" e
       JOIN (SELECT Min(createdon) createdOn,
                    id
             FROM   "${(type == "buy" ? "estates_agg" : "estates_rent_agg")}"
             GROUP  BY id)q
         ON q.id = e.id
WHERE  strftime('%Y-%m-%d %H:%M:%S',q.createdon) > (SELECT Datetime('now', ?1))
AND e.size>=?2 AND e.size<=?3 AND e.price>=?4 AND  e.price<=?5 AND (${dispFilter})
ORDER  BY e.createdon desc
`
}