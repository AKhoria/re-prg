export class Session {
    sessions = {}
    constructor(dbConnection) {
        this.db = dbConnection
    }

    async newFilter(userId, type) {
        await this.db.run('DELETE FROM queries WHERE user_id=? AND type=? and is_ready=0', [userId, type])
        this.sessions[userId] = this.createFilter(type)
        return this.sessions[userId]
    }

    async getFilter(userId) {
        if (this.sessions[userId]) {
            return this.sessions[userId]
        }
        const queries = await this.db.all('SELECT * FROM queries WHERE user_id=?1 AND is_ready=0', [userId]);
        if (queries.length === 0) {
            return null
        } else {
            this.sessions[userId] = queries[0]
        }
        return this.sessions[userId]
    }
    async flushSessionsToDB() {
        const tasks = Object.keys(this.sessions).map(async userId => {
            const filter = this.sessions[userId]
            if (filter && (new Date - filter.updatedAt) > 60 * 60 * 1000) {
                await this.db.run('DELETE FROM queries WHERE user_id=? AND is_ready=0', [userId])
                await this.db.run('INSERT INTO queries VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [userId, filter.max_price, filter.min_price, filter.max_size, filter.min_size, filter.disposition, filter.type, 0]);
                delete this.sessions[userId]
            }
        })
        await Promise.all(tasks);
    }

    async clear(userId) {
        const filter = await this.getFilter(userId)
        if (filter) {
            const type = this.sessions[userId].type
            this.newFilter(userId, type)
        }
    }

    async removeFilter(userId) {
        if (this.sessions[userId]) {
            delete this.sessions[userId]
        }
        await this.db.run('DELETE FROM queries WHERE user_id=?', [userId])
    }

    async createQuery(userId) {
        let max_price = null
        let min_price = null
        let max_size = null
        let min_size = null
        let disposition = null
        const filter = await this.getFilter(userId)
        if (!filter) {
            throw `null filter for ${userId}`
        }
        [...filter.fields.keys()].map(x => { return { "name": x, "value": filter.fields.get(x) } })
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
                    case "Disposition":
                        disposition = x.value.replace(/\s/g, '').toLowerCase()
                        break;
                    default:
                        break;
                }
            })
        // move to await
        console.log([`subscrb`, userId, max_price, min_price, max_size, min_size, disposition])
        await this.db.run('DELETE FROM queries WHERE user_id=?', [userId])
        await this.db.run('INSERT INTO queries VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
            [userId, max_price, min_price, max_size, min_size, disposition, filter.type]);
    }

    dispositionList = new Set(["1+kk", "1+1", "2+kk", "2+1", "3+kk", "3+1", "4+kk", "4+1", "5+kk", "5+1"])
    validateField(fieldName, value) {
        switch (fieldName) {
            case 'Disposition':
                var result = ""
                value.split(",").forEach(val =>{
                    if (!this.dispositionList.has(val)) {
                        result = `I don't know such a disposition(${val}), example of the right format: 1+kk,1+1`
                    }
                })
                return result
            default:
                if (isNaN(value)) {
                    return "Value should be a simple number"
                }
                break;
        }
        return ""
    }

    createFilter(type) {
        return {
            "fields": new Map([
                ["Min Size", null],
                ['Max Size', null],
                ['Min Price', null],
                ['Max Price', null],
                ['Disposition', null],
            ]),
            'currentField': null,
            'type': type,
            'updatedAt': new Date
        }
    }
}