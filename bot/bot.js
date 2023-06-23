import TelegramBot from 'node-telegram-bot-api';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import express from 'express'

const token = process.env.TOKEN;
const url = process.env.URL
const port = process.env.PORT
const dbPath = process.env.DB_PATH || "./re-prg/site/estates.db";
const db2Path = process.env.DB2_PATH || "./estates.db";
const defaultTime = "-6"

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
            disposition TEXT
          )`)
        return {db, dbqueries}
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




const sessions = {}
const params = ["Min Size", 'Max Size', 'Min Price', 'Max Price', 'Disposition']
function createFilter() {
    return {
        "fields": {
            "Min Size": null,
            'Max Size': null,
            'Min Price': null,
            'Max Price': null,
        },
        //'Disposition':null,
        'currentField': null
    }
}

function setup(msg, text) {
    const filter = sessions[msg.chat.id]
    const params = Object.keys(filter.fields).map(key => `${key}(${filter.fields[key] ?? 'not set'})`)
    params.push("cancel")
    const opts = {
        reply_to_message_id: msg.message_id,
        reply_markup: JSON.stringify({
            keyboard: [
                ...params.map(x => [x]),
                ['subscribe', 'unsubscribe']
            ]
        })
    };
    bot.sendMessage(msg.chat.id, text ?? 'Set filter or press subscribe', opts);
}

function clear(msg, text) {
    const opts = {
        reply_markup: {
            remove_keyboard: true
        }
    };
    bot.sendMessage(msg.chat.id, text ?? 'write /start to start again', opts)
}

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    let messageText = msg.text;
    if (!sessions[msg.chat.id]) {
        sessions[msg.chat.id] = createFilter()
    }
    if (messageText && messageText.startsWith('/start')) {
        bot.sendMessage(chatId, 'Welcome! Please choose parameters of the appartament of your dream and press "subscribe"');
        setup(msg)
        return;
    }

    switch (messageText) {
        case "subscribe":
            bot.sendMessage(msg.chat.id, `Subscribed! Will be seinding updates every 8 hours`);
            await subscribeUser(msg.chat.id);
            processQueries(msg.chat.id, defaultTime)
            clear(msg, "You can unsubscribe or create a new subscribtion by /start")
            break;
        case "unsubscribe":
            await unsubscribeUser(msg.chat.id)
            bot.sendMessage(msg.chat.id, `Unsubscribed!`);
            clear(msg, "Unsubscribed! You can subscribe by /start")
            break
        case "Disposition":
            bot.sendMessage(msg.chat.id, `Aren't not supported yet`);
            setup(msg)
            break
        case "cancel":
            sessions[msg.chat.id].currentField = null
            sessions[msg.chat.id].fields[sessions[msg.chat.id].currentField] = null
            setup(msg)
            break
        default:
            messageText = messageText.replace(/\(.*\)/, "")
            if (sessions[msg.chat.id].currentField == null &&
                sessions[msg.chat.id].fields.hasOwnProperty(messageText)) {
                sessions[msg.chat.id].currentField = messageText
                bot.sendMessage(msg.chat.id, `Enter ${messageText}`);
            } else if (sessions[msg.chat.id].currentField != null) {
                sessions[msg.chat.id].fields[sessions[msg.chat.id].currentField] = messageText
                sessions[msg.chat.id].currentField = null
                setup(msg)
            } else {
                bot.sendMessage(msg.chat.id, `Not expected command, write /start to start again`);
            }
    }
})

async function unsubscribeUser(userId) {
    delete sessions[userId]
    await dbqueries.run('DELETE FROM queries WHERE user_id=?', [userId])
}

async function subscribeUser(userId) {
    let max_price = null
    let min_price = null
    let max_size = null
    let min_size = null
    let disposition = null
    const keys = Object.keys(sessions[userId].fields)
    keys.map(x => { return { "name": x, "value": sessions[userId].fields[x] } })
        .filter(x => x.value)?.forEach(x => {
            switch (x.name) {
                case "Min Price":
                    min_price = x.value.replace(/\s/g, '')
                    break;
                case "Max Price":
                    max_price = x.value.replace(/\s/g, '')
                    break;
                case "Min Size":
                    min_size = x.value.replace(/\s/g, '')
                    break;
                case "Max Size":
                    max_size = x.value.replace(/\s/g, '')
                    break;

                default:
                    break;
            }
        })
    // move to await
    console.log([`subscrb`, userId, max_price, min_price, max_size, min_size, disposition])
    await dbqueries.run('DELETE FROM queries WHERE user_id=?', [userId])
    await dbqueries.run('INSERT INTO queries VALUES (?, ?, ?, ?, ?, ?)',
        [userId, max_price, min_price, max_size, min_size, disposition]);
    delete sessions[userId]
}


function runJob() {
    // Job running every hour
    setTimeout(runJob, 3600000 * 8); // switch back to hour
    console.log("Run job!")
    // Retrieve queries from the database
    processQueries();
}

runJob();



const getRESQL = `
SELECT e.url
FROM   "estates_agg" e
       JOIN (SELECT Min(createdon) createdOn,
                    id
             FROM   "estates_agg"
             GROUP  BY id)q
         ON q.id = e.id
WHERE  q.createdon > (SELECT Datetime('now', ?1))
AND e.size>?2 AND e.size<?3 AND e.price>?4 AND  e.price<?5 AND (?6 IS NULL OR e.disposition=?6)
ORDER  BY e.createdon desc
`

async function processQueries(userId, lastHours) {
    if (!lastHours) {
        lastHours = defaultTime
    }
    const queries = await dbqueries.all('SELECT * FROM queries WHERE user_id=?1 OR ?1 IS NULL', [userId]);

    const q = {};
    queries.forEach((query) => {
        const { user_id, max_price, min_price, max_size, min_size, disposition } = query;
        const key = [min_size, max_size, min_price, max_price];
        if (!q[key]) {
            q[key] = [user_id];
        } else {
            q[key].push(user_id);
        }
    });

    const tasks = Object.keys(q).map(async k => {
        const users = q[k];
        const [min_size, max_size, min_price, max_price] = k.split(",").map(x => x === '' ? null : x)
        const params = [`${lastHours} hour`, min_size ?? 0, max_size ?? 999, min_price ?? 0, max_price ?? 999999999, null]
        console.log([getRESQL, users, params])
        const rows = await db.all(getRESQL, params);
        console.log(`found ${rows.length} rows`)
        //TODO send group of user
        users.forEach(u => {
            //bot.sendMessage(user_id, rows.map(r=>r.url).join("/n"))
            rows.forEach(r => bot.sendMessage(u, r.url));
        });
    })

    await Promise.all(tasks);
}

