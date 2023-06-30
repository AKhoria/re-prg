export function GetNewAdvs(){
    return `
    SELECT e.id,e.price, e.createdOn, e.url, e.text, e.disposition, e.source
    FROM   "estates_agg" e
           JOIN (SELECT Min(createdon) createdOn,
                        id
                 FROM   "estates_agg"
                 GROUP  BY id)q
             ON q.id = e.id
    WHERE  strftime('%Y-%m-%d %H:%M:%S',q.createdon) > (Datetime('now', '-1 day'))
    AND e.size>? AND e.size<? AND e.price>? AND e.price<?
    ORDER  BY e.createdon desc
    `
}

export function GetChangedAdvs(){
    return `
    SELECT q.id,
    max(q.text) text,
    q.url,
    q.first_price,
    q.last_price,
   "Same add" type,
    q.price_history,
    Round(( ( q.last_price - q.first_price ) / q.first_price ) * 100, 2) AS
    change
FROM   (SELECT id,
            text,
            url,
            First_value(price)
              OVER(
                partition BY id
                ORDER BY createdon
                RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                ) first_price,
            Last_value(price)
              OVER(
                partition BY id
                ORDER BY createdon
                RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) last_price,
            group_concat(price, " -> ")
                OVER(
                  partition BY id
                  ORDER BY createdon
                  RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                  ) price_history
     FROM   estates_agg
     WHERE  price != "1.0" AND size>? AND size<? AND price>? AND price<?
            AND strftime('%Y-%m-%d %H:%M:%S',updatedon) > (Datetime('now', '-1 day')))q
WHERE  q.first_price != q.last_price
    AND Abs(change) < 50
GROUP  BY q.id,
       q.url,
       q.first_price,
       q.last_price,
       q.price_history

union


SELECT group_concat(q.id, ","),
    max(q.text) text,
    group_concat(q.url,","),
    q.first_price,
    q.last_price,
   "Similar add" type,
    q.price_history,
    Round(( ( q.last_price - q.first_price ) / q.first_price ) * 100, 2) AS
    change
FROM   (SELECT id,
            text,
            url,
            First_value(price)
              OVER(
                partition BY (text || locality || gpsLat || gpsLon || disposition || size)
                ORDER BY createdon
                RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                ) first_price,
            Last_value(price)
              OVER(
                partition BY (text || locality || gpsLat || gpsLon || disposition || size)
                ORDER BY createdon
                RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) last_price,
            group_concat(price, " -> ")
                OVER(
                  partition BY (text || locality || gpsLat || gpsLon || disposition || size)
                  ORDER BY createdon
                  RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                  ) price_history
     FROM   estates_agg
     WHERE  price != "1.0" AND price != "1.0" AND size>? AND size<? AND price>? AND price<?
            AND strftime('%Y-%m-%d %H:%M:%S',updatedon) > (Datetime('now', '-1 day')))q
WHERE  q.first_price != q.last_price
    AND Abs(change) < 50
GROUP  BY
       q.first_price,
       q.last_price,
       q.price_history

order by change`
}

export function GetAdv(){
    return `select id, url,max(text) text, locality, disposition, max(size) size,gpsLat,gpsLon , group_concat(strftime("%Y-%m-%d %H:%M" ,createdOn) || ";" || price, ",") history  from "estates_agg" where id= ?
    group by id,url, locality, disposition,gpsLat,gpsLon `
}

export function GetGraph(){
    return `select cur, sum(price)
    OVER(
      ORDER BY cur
      ) price from (
select q.cur, avg((cur_price-prev_price)/prev_price) price from(
select  q.cur,q.id, (select price from estates_agg where id=q.id and strftime("%Y-%m-%d.%H" ,createdOn)=q.cur ) cur_price, (select price from estates_agg where id=q.id and strftime("%Y-%m-%d.%H" ,createdOn)=q.prev ) prev_price from
(select c.id, c.createdOn cur, max(p.createdOn) prev from 
(select distinct strftime("%Y-%m-%d.%H" ,createdOn) createdOn, id, price from estates_agg) c
join 
(select distinct strftime("%Y-%m-%d.%H" ,createdOn) createdOn, id from estates_agg) p on c.id=p.id and p.createdOn<c.createdOn
group by c.id, c.createdOn) as q
where cur_price!=1 and prev_price!=1 and ABS(prev_price-cur_price)/cur_price<0.5)q
group by q.cur)
ORDER BY cur`
}

export function GetAvgPrice(){
  return `SELECT date,
            Avg(pricepermeter) price
          FROM  (SELECT Strftime("%Y-%m-%d.%H", e.createdon) date,
                  e.price / e.size                       pricePerMeter
            FROM   "estates_agg" e
            WHERE  e.size IS NOT NULL
                  AND e.price > 1
                  AND e.size >?
                  AND e.size <?
                  AND e.price >?
                  AND e.price <? )q
          GROUP  BY date
          ORDER  BY date `
}
