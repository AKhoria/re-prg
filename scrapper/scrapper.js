
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import {open} from 'sqlite';

import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

async function scrapp() {
    const bezrealky = await getBezrealkyData()
    let updatedCount = await upgradeAggregatedData(bezrealky)
    console.log(`updated bezrealky loaded ${bezrealky.length} saved: ${updatedCount}`)

    const sreality = await getSrealityData()
    updatedCount = await upgradeAggregatedData(sreality)
    console.log(`updated sreality loaded ${sreality.length} saved: ${updatedCount}`)
}
let isRent = false
console.log("Load selling")
await scrapp()
isRent = true
console.log("Load renting")
await scrapp()

function tableName() {
    return isRent ? "estates_rent_agg" : "estates_agg";
}


async function getBezrealkyData() {
    const url = 'https://api.bezrealitky.cz/graphql/';
    const filename = path.resolve(__dirname, 'query.txt');
    const content = fs.readFileSync(filename, 'utf8');
    const bezRealityDispozition = {"DISP_1_1": "1+1 ", "DISP_1_IZB": "jednopokojový ", "DISP_1_KK": "1+kk ", "DISP_2_1": "2+1 ", "DISP_2_IZB": "dvoupokojový ", "DISP_2_KK": "2+kk ", "DISP_3_1": "3+1 ", "DISP_3_IZB": "třípokojový ", "DISP_3_KK": "3+kk ", "DISP_4_1": "4+1 ", "DISP_4_IZB": "4pokojový ", "DISP_4_KK": "4+kk ", "DISP_5_1": "5+1 ", "DISP_5_IZB": "5pokojový ", "DISP_5_KK": "5+kk ", "DISP_6_1": "6+1 ", "DISP_6_IZB": "6pokojový ", "DISP_6_KK": "6+kk ", "DISP_7_1": "7+1 "}

    // Data for POST request
    const payload = {
        "operationName": "AdvertList",
        "variables": {"limit": 300, "offset": 0, "order": "TIMEORDER_DESC", "offerType": isRent ? ["PRONAJEM"] : ["PRODEJ"], "estateType": ["BYT"], "ownership": ["OSOBNI"], "regionOsmIds": ["R435541"], "locale": "CS"},
        "query": content
    };

    const newData = [];
    while (true) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!data) {
            break;
        }

        for (const item of data.data.listAdverts.list) {
            const matchSize = /.*\s(\d+)\s*m².*/.exec(item.imageAltText)
            const sqlEntry = {
                id: item.id.toString(),
                price: item.price,
                createdOn: new Date().toISOString(),
                text: item.imageAltText,
                gpsLat: item.gps?.lat,
                gpsLon: item.gps?.lng,
                disposition: bezRealityDispozition[item.disposition] ?? "other",
                locality: item.address,
                url: `https://www.bezrealitky.cz/nemovitosti-byty-domy/${item.uri}`,
                source: "bezrealitky",
                size: matchSize && matchSize[1] ? matchSize[1] : "",
                "jsonData": JSON.stringify(item)
            }
            newData.push(sqlEntry)
        }
        // Increment offset for next request
        payload.variables.offset += 300;

        // Check if there are more entries to fetch
        if (data.data.listAdverts.list.length < 300) {
            break;
        }
    }
    return newData
}
async function getSrealityData() {
    const headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36'};
    const srealityDisposition = {
        2: "1+kk",
        3: "1+1",
        4: "2+kk",
        5: "2+1",
        6: "3+kk",
        7: "3+1",
        8: "4+kk",
        9: "4+1",
        10: "5+kk",
        11: "5+1"
    }
    const getUrl = (page) => {
        const baseUrl = `https://www.sreality.cz/api/cs/v2/estates?category_main_cb=1&category_type_cb=${(isRent ? '2' : '1')}&estate_age=8&locality_region_id=10&no_auction=1&no_shares=1&ownership=1`;
        return baseUrl + `&page=${page}&per_page=100`;
    }

    async function loadChunk(page) {
        const url = getUrl(page);

        const response1 = await fetch(url, {headers});
        const data1 = await response1.json();

        if (!data1._embedded.estates || data1._embedded.estates.length === 0) {
            return [];
        }

        const items = data1._embedded.estates;

        const newData = [];
        for (const item of items) {
            const matchSize = /.*\s(\d+)\s*m².*/.exec(item.name)
            var sqlEntry = {
                createdOn: new Date().toISOString(),
                id: item.hash_id.toString(),
                price: item.price,
                text: item.name,
                gpsLat: item.gps?.lat,
                gpsLon: item.gps?.lon,
                disposition: srealityDisposition[item.seo.category_sub_cb] ?? "other",
                locality: item.seo?.locality,
                source: "sreality",
                size: matchSize && matchSize[1] ? matchSize[1] : "",
                jsonData: JSON.stringify(item)
            }
            sqlEntry.url = `https://www.sreality.cz/detail/${(isRent ? "pronajem" : "prodej")}/byt/${sqlEntry.disposition}/${sqlEntry.locality}/${sqlEntry.id}`
            newData.push(sqlEntry)
        }
        return newData
    }
    let page = 1
    const res = []
    while (true) {
        const chunk = await loadChunk(page);
        res.push(...chunk)
        if (chunk.length === 0) {
            break;
        }
        page++;
    }
    return res
}

async function upgradeAggregatedData(data) {
    let saved = 0
    const db = await open({filename: path.resolve(__dirname, 'estates.db'), driver: sqlite3.Database});
    data.forEach(async item => {
        const result = await db.get(`SELECT price FROM ${tableName()} WHERE id = ? order by createdOn desc`, item.id);

        if (result && result.price === item.price) {
            // The data hash exists, update the updatedOn field
            await db.run(`UPDATE ${tableName()} SET updatedOn = ? WHERE id = ?`, item.createdOn, item.id);

        } else {
            // The data is new or different, insert it into the database
            const keys = Object.keys(item)
            const vals = keys.map(x => item[x])
            await db.run(`INSERT INTO ${tableName()} (${keys.join(",")}) VALUES (${keys.map(x => "?").join(",")})`, vals);
            saved += 1;
        }
    });
    await db.close();
    return saved
}