export class Start{
    constructor(bot,sessions) {
        this.bot = bot
        this.sessions = sessions
    }
    name = () => "/start"
    execute = msg => {
        const opts = {
            reply_markup: JSON.stringify({
                keyboard: [
                    ['/buy', '/rent']
                ]
            })
        };
        this.bot.sendMessage(msg.chat.id, 'Welcome! Please, choose the action and parameters of the appartament of your dream and press "subscribe"', opts);
        return;
    }
}
export class Rent{
    constructor(bot,sessions) {
        this.bot = bot
        this.sessions = sessions
    }
    name = () => "/rent"
    execute = async msg => {
        await this.sessions.newFilter(msg.chat.id, 'rent')
        return await setup(this.bot, this.sessions, msg)
    }
}
export class Buy{
    constructor(bot,sessions) {
        this.bot = bot
        this.sessions = sessions
    }
    name = () => "/buy"
    execute = async msg => {
        await this.sessions.newFilter(msg.chat.id, 'buy')
        return await setup(this.bot, this.sessions, msg)
    }
}
export class Subscribe{
    constructor(bot,sessions,processQueriesFunc) {
        this.bot = bot
        this.sessions = sessions
        this.processQueries = processQueriesFunc
    }
    name = () => "subscribe"
    execute = async msg => {
        await this.sessions.createQuery(msg.chat.id);
        await this.bot.sendMessage(msg.chat.id, `Subscribed! Will be seinding updates every 8 hours`);
        await this.processQueries(msg.chat.id, "24")
        clear(this.bot, msg, "You can /unsubscribe or create a new subscribtion replacing the current one")
    }
}
export class Unsubscribe{
    constructor(bot,sessions) {
        this.bot = bot
        this.sessions = sessions
    }
    name = () =>"/unsubscribe"
    execute = async msg => {
        await this.sessions.removeFilter(msg.chat.id)
        clear(this.bot,msg, "Unsubscribed! You can start a new subscribtion by /buy or /rent")
    }
}
export class Cancel{
    constructor(bot,sessions) {
        this.bot = bot
        this.sessions = sessions
    }
    name = () => "cancel"
    execute = async msg => {
        this.sessions.clear(this.bot, msg.chat.id)
        await setup(this.bot, this.sessions, msg)
    }
}
export class SetFilter{
    constructor(bot,sessions) {
        this.bot = bot
        this.sessions = sessions
    }
    name = () => "*"
    execute = async msg => {
        const messageText = msg.text.replace(/\(.*\)/, "")
        var filter = await this.sessions.getFilter(msg.chat.id)
        if (filter != null &&
            filter.currentField == null &&
            filter.fields.has(messageText)) {
            filter.currentField = messageText
            await  this.bot.sendMessage(msg.chat.id, `Enter ${messageText}`);
        } else if (
            filter != null &&
            filter.currentField != null) {
            filter.fields.set(filter.currentField, messageText)
            filter.currentField = null
            await setup(this.bot, this.sessions, msg)
        } else {
            await this.bot.sendMessage(msg.chat.id, `Not expected command, write /start to start again`);
        }
    }
}

async function setup(bot,sessions, msg, text) {
    const filter = await sessions.getFilter(msg.chat.id)
    if (!filter) {
        await bot.sendMessage(msg.chat.id, "something went wrong, please start again")
        return
    }

    const params = [...filter.fields.keys()].map(key => `${key}(${filter.fields.get(key) ?? 'not set'})`)
    params.push("cancel")
    const opts = {
        reply_to_message_id: msg.message_id,
        reply_markup: JSON.stringify({
            keyboard: [
                ...params.map(x => [x]),
                ['subscribe']
            ]
        })
    };
    bot.sendMessage(msg.chat.id, text ?? 'Set filter or press subscribe', opts);
}

function clear(bot, msg, text) {
    const opts = {
        reply_markup: {
            reply_to_message_id: msg.message_id,
            remove_keyboard: true
        }
    };
    bot.sendMessage(msg.chat.id, text ?? 'write /start to start again', opts)
}
