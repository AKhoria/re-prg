
import React, { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import './App.css';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import 'bootstrap/dist/css/bootstrap.min.css';
import MaterialReactTable from 'material-react-table';
import { LineChart, Line, CartesianGrid, XAxis, Tooltip } from 'recharts';


function App() {

  const [adverbs, setAdverbs] = useState([])
  const [changes, setChanges] = useState([])
  const [dynamic, setDynamic] = useState([])
  const [avgPrices, setAvg] = useState([])


  useEffect(() => {
    axios.get('/api/newAdvs' + (window.location.search ?? "")).then((response) => {
      setAdverbs(response.data)
    })
    axios.get('/api/changedAdvs' + (window.location.search ?? "")).then((response) => {
      setChanges(response.data)
    })
    axios.get('/api/dynamic').then((response) => {
      setDynamic(response.data)
    })
    axios.get('/api/getAvgPrices').then((response) => {
      setAvg(response.data)
    })
  }, [])
  const columns1 = useMemo(() => [
    {
      accessorKey: 'id',
      header: 'Id'
    }, {
      accessorFn: (row) => row,
      id: "title",
      field: 'text',
      header: 'Title',
      Cell: ({ renderedCellValue }) => <a target="_blank" href={renderedCellValue.url} rel="noreferrer"> {renderedCellValue.text} </a>
    }, {
      accessorKey: 'price',
      header: 'Price',
    }, {
      accessorKey: 'disposition',
      header: 'Disposition',
    }, {
      accessorKey: 'source',
      header: 'Source',
    }, {
      accessorKey: 'createdOn',
      header: 'Created On',
    }
  ]);

  const columns2 = useMemo(() => [
    {
      accessorFn: (row) => row,
      id: 'id',
      header: 'Id',
      Cell: ({ renderedCellValue }) => {
        let ids = renderedCellValue.id.split(",");
        return <div>
          {
            ids.map((id, i) => <div key={i}>{parseInt(id)}</div>)
          }
        </div>
      }
    }, {
      accessorFn: (row) => row,
      id: "title",
      header: 'Title',
      field: 'text',
      Cell: ({ renderedCellValue }) => {
        let urls = renderedCellValue.url.split(",");

        return <a target="_blank" href={urls[0]} rel="noreferrer"> {renderedCellValue.text} </a>
      }
    }, {
      accessorKey: 'first_price',
      header: 'First Price',
    }, {
      accessorKey: 'last_price',
      header: 'Last Price',
      field: 'last_price',
    },
    {
      accessorKey: 'change',
      header: 'Change',
    },
    {
      accessorKey: 'type',
      header: 'Type of analisys',
    },
    {
      accessorFn: (row) => row,
      id: "links",
      header: 'Links',
      Cell: ({ renderedCellValue }) => {
        let links = renderedCellValue.url.split(",");
        return <div>
          {
            links.map((link, i) => <div key={i}><a href={link} target="_blank" rel="noreferrer">link{i}</a></div>)
          }
        </div>
      }
    },
    {
      accessorKey: "price_history",
      header: 'History',
    }]);


  function Details(props) {
    const id = props.addId;
    const [add, setAdd] = useState(null)
    const [history, setHistory] = useState(null)
    useEffect(() => {
      axios.get('/api/adv?id=' + id).then((response) => {
        setAdd(response.data)
        setHistory(response.data.history.split(",").map(pair => {
          let [date, price] = pair.split(";")
          return { date, price }
        }))
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
    </Container> : null
  }
  function Index() {
    return <Container>
      <Row>
        <Col>
          <h3>New advs (24h):</h3>
          <MaterialReactTable
            columns={columns1}
            data={adverbs}
            renderDetailPanel={({ row }) => <Details addId={row.original.id}></Details>}
          />
        </Col>
      </Row>
      <Row>
        <Col>
          <h3>Price changes:</h3>
          <MaterialReactTable
            columns={columns2}
            data={changes}
            renderDetailPanel={({ row }) => <Details addId={row.original.id}></Details>}
          />
        </Col>
      </Row>
      <Row>
        <Col>
          <h3>Average changes price since 2023-02-05 (in progress...)</h3>
          <LineChart
            width={1300}
            height={400}
            data={dynamic}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <Line type="monotone" dataKey="price" stroke="#ff7300" yAxisId={0} />
            <XAxis dataKey="date" />
            <CartesianGrid stroke="#ccc" />
            <Tooltip />
          </LineChart>
        </Col>
      </Row>
      <Row>
        <Col>
          <h3>Price per square meter</h3>
          <LineChart
            width={1300}
            height={400}
            data={avgPrices}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <Line type="monotone" dataKey="price" stroke="#ff7300" yAxisId={0} />
            <XAxis dataKey="date" />
            <CartesianGrid stroke="#ccc" />
            <Tooltip />
          </LineChart>
        </Col>
      </Row>
    </Container>
  }

  return Index();
}

export default App;
