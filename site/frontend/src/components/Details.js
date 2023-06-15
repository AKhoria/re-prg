
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import 'bootstrap/dist/css/bootstrap.min.css';
import { LineChart, Line, CartesianGrid, XAxis, Tooltip } from 'recharts';
import 'reactjs-popup/dist/index.css';

export function Details(props) {
    const id = props.addId;
    const [add, setAdd] = useState(null)
    const [history, setHistory] = useState(null)
    useEffect(() => {
      axios.get('/api/adv?id=' + id).then((response) => {
        if (response.data) {
          setAdd(response.data)
          setHistory(response.data.history.split(",").map(pair => {
            let [date, price] = pair.split(";")
            return { date, price }
          }))
        }
      })
    }, [id])

    return add ? <Container className='border text-left'>
      <Row><Col>{history.length > 1 ?
        <LineChart data={history} width={600}
          height={200}>
          <Line type="monotone" dataKey="price" stroke="#ff7300" yAxisId={0} />
          <XAxis dataKey="date" />
          <CartesianGrid stroke="#ccc" />
          <Tooltip />
        </LineChart>
        : null}
      </Col></Row>
      <Row className='border'><Col>id</Col><Col>{add.id}</Col></Row>
      <Row className='border'><Col>text</Col><Col><a href={add.url}>{add.text}</a></Col></Row>
      <Row className='border'><Col>size</Col><Col>{add.size}</Col></Row>
      <Row className='border'><Col>locality</Col>{add.locality}<Col></Col></Row>
      <Row className='border'><Col>disposition</Col><Col>{add.disposition}</Col></Row>
      <Row className='border'><Col>gpsLat	gpsLon	</Col><Col>{add.gpsLat}-{add.gpsLon}</Col></Row>
      <Row className='border'><Col>history</Col><Col>{history.map(history =>

        <Row key={history.date}><Col>{history.date}</Col><Col>{history.price}</Col></Row>
      )}</Col></Row>
    </Container> : <span>Not found</span>
  }