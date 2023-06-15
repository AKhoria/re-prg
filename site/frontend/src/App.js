
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import 'bootstrap/dist/css/bootstrap.min.css';
import MaterialReactTable from 'material-react-table';
import { LineChart, Line, CartesianGrid, XAxis, Tooltip } from 'recharts';
import Popup from 'reactjs-popup';
import 'reactjs-popup/dist/index.css';
import {Details} from "./components/Details"
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';


function App() {

  const [adverbs, setAdverbs] = useState([])
  const [changes, setChanges] = useState([])
  const [dynamic, setDynamic] = useState([])
  const [avgPrices, setAvg] = useState([])
  const [searchInput, setSearchInput] = useState("");
  const [openAdv, setOpenAdv] = useState(false)


  // search input
  const handleChange = (e) => {
    e.preventDefault();
    setSearchInput(e.target.value);
  };
  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      setOpenAdv(true)
    }
  };
  const closeModal = (e) => {
    setOpenAdv(false)
  }


  // Preload
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

  const columnsForNewAdv = [
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
  ];

  const columnsForDiscouts = [
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
      size: '100'
    }, {
      accessorKey: 'last_price',
      header: 'Last Price',
      field: 'last_price',
      size: '100'
    },
    {
      accessorKey: 'change',
      header: 'Change',
      size: '50'
    },
    {
      accessorKey: 'type',
      header: 'Type of analisys',
      size: '100'
    },
    {
      accessorFn: (row) => row,
      id: "links",
      header: 'Links',
      size: '100',
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
    }];



  function Index() {
    return <Container >
      <Row className='mainrow'>
        <Col width={100}>
        <Form.Control 
            type="text"
            value={searchInput}
            placeholder='Enter ID'
            onChange={handleChange}
            onKeyUp={handleKeyPress}
            width={200}
            size="lg" 
          />
          </Col>
          <Col>
          <Button onClick={()=>setOpenAdv(true)} size="lg">Search</Button>
          <Popup open={openAdv} closeOnDocumentClick onClose={closeModal}>
            <div>
              <Details addId={searchInput}></Details>
            </div>
          </Popup></Col>
      </Row>
      <Row className='mainrow'>
        <Col>
          <h3>New advs (24h):</h3>
          <MaterialReactTable
            columns={columnsForNewAdv}
            data={adverbs}
            renderDetailPanel={({ row }) => <Details addId={row.original.id}></Details>}
          />
        </Col>
      </Row>
      <Row className='mainrow'>
        <Col>
          <h3 className='title'>Price changes:</h3>
          <MaterialReactTable
            columns={columnsForDiscouts}
            data={changes}
            renderDetailPanel={({ row }) => <Details addId={row.original.id}></Details>}
          />
        </Col>
      </Row>
      <Row className='mainrow'>
        <Col>
          <h3 className='title'>Average changes price since 2023-02-05 (in progress...)</h3>
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
      <Row className='mainrow'>
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
