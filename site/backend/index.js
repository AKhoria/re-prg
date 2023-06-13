import { GetChangedAdvs, GetNewAdvs, GetAdv, GetGraph, GetAvgPrice } from "./queries.js"
import express from "express"
import cors from "cors"
import sqlite3 from "sqlite3"
import NodeCache from "node-cache"

const app = express();

const hostname = '0.0.0.0';
const port = process.env.NODE_PORT || 3001;
const dbPath = process.env.DB_PATH || "../estates.db";
const db = new sqlite3.Database(dbPath);
app.get("/api/newAdvs", cors(), (request, res) => {
  db.all(GetNewAdvs(), [request.query.minSize ?? 0, request.query.maxSize ?? 1000, request.query.minPrice ?? 0, request.query.maxPrice ?? 999999999], (err, rows) => {
    if (err) {
      throw err;
    }

    res.json(rows);
  });
});

app.get("/api/adv", cors(), (request, res) => {
  db.all(GetAdv(), [request.query.id], (err, rows) => {
    if (err) {
      throw err;
    }

    res.json(rows.length > 0 ? rows[0] : null);
  });
});

app.get("/api/changedAdvs", cors(), (request, res) => {

  db.all(GetChangedAdvs(), [request.query.minSize ?? 0, request.query.maxSize ?? 1000, request.query.minPrice ?? 0, request.query.maxPrice ?? 999999999], (err, rows) => {
    if (err) {
      throw err;
    }
    res.json(rows);
  });
});

app.get("/api/getAvgPrices", cors(), (request, res) => {

  db.all(GetAvgPrice(), [request.query.minSize ?? 0, request.query.maxSize ?? 1000, request.query.minPrice ?? 0, request.query.maxPrice ?? 999999999], (err, rows) => {
    if (err) {
      throw err;
    }
    res.json(rows);
  });
});

const myCache = new NodeCache({ stdTTL: 60 * 60 * 4, checkperiod: 120 });
app.get("/api/dynamic", cors(), (request, res) => {
  if (!myCache.has("dynamic")) {
    db.all(GetGraph(), [], (err, rows) => {
      if (err) {
        throw err;
      }
      myCache.set("dynamic", rows)
      console.log(`cache invalidated}`, new Date().toISOString())
      res.json(rows);
    });
  } else {
    res.json(myCache.get("dynamic"));
  }
});



//app.use(cors())
app.listen(port, hostname, () => {
  console.log(`Listen on the port ${port}... db: ${dbPath}`);
});