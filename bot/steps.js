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
        const invite = `
        Welcome! Please, choose the action and parameters of the appartament of your dream and press "subscribe"
The filter input should consist of simple numbers(do not add a currency or dimension).
Example: 
    Enter Max Price
    6000000
    Enter Min Size
    45
means that you want to get apparts bigger then 45 square meters with price less than 6000000 CZK`
        this.bot.sendMessage(msg.chat.id, invite, opts);

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
        await this.bot.sendMessage(msg.chat.id, `Subscribed! Will be sending updates every 3 hours`);
        await this.processQueries(msg.chat.id, "24")
        await clear(this.bot,msg, "You can /unsubscribe or create a new subscribtion replacing the current one")
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
        await clear(this.bot,msg, "Unsubscribed! You can start a new subscribtion by /buy or /rent")
    }
}
export class Cancel{
    constructor(bot,sessions) {
        this.bot = bot
        this.sessions = sessions
    }
    name = () => "cancel"
    execute = async msg => {
        await this.sessions.clear(msg.chat.id)
        await clear(this.bot,msg, "Use /buy or /rent to start")
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
    const opts = {
        reply_to_message_id: msg.message_id,
        reply_markup: JSON.stringify({
            keyboard: [
                ...params.map(x => [x]),
                ['subscribe','cancel']
            ]
        })
    };
    const defMsg = `Set filter or press subscribe.`

    bot.sendMessage(msg.chat.id, text ?? defMsg, opts);
}

async function clear(bot, msg, text) {
    const opts = {
        reply_markup: {
            reply_to_message_id: msg.message_id,
            remove_keyboard: true
        }
    };
    await bot.sendMessage(msg.chat.id, text, opts)
}
