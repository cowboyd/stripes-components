import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Icon from '@folio/stripes-components/lib/Icon';
import isEqual from 'lodash/isEqual';
import debounce from 'lodash/debounce';
import css from './MCLRenderer.css';
import defaultRowFormatter from './defaultRowFormatter';

const propTypes = {
  infinite: PropTypes.bool,
  onScroll: PropTypes.func,
  onFetch: PropTypes.func,
  contentData: PropTypes.array,
  height: PropTypes.number,
  width: PropTypes.number,
  formatter: PropTypes.object,
  visibleColumns: PropTypes.array,
  loading: PropTypes.bool,
  columnMapping: PropTypes.object,
  onHeaderClick: PropTypes.func,
  onRowClick: PropTypes.func,
  isEmptyMessage: PropTypes.string,
  sortOrder: PropTypes.string,
  maxHeight: PropTypes.number,
  rowFormatter: PropTypes.func,
  scrollToIndex: PropTypes.number,
}

const defaultProps = {
  onScroll: (e) => null,
  onRowClick: (e) => null,
  onHeaderClick: (e) => null,
  columnMapping: {},
  formatter: {},
  isEmptyMessage: "The list contains no items",
  contentData: [],
  selectedClass: css.selected,
  sortedClass: css.sorted,
  rowFormatter: defaultRowFormatter,
  scrollToIndex: 0,
}

class MCLRenderer extends React.Component{
  constructor(props){
    super(props);

    const { visibleColumns, contentData, scrollToIndex } = this.props;

    this.rowCache = [];
    this.rowContainer = null;
    this.headerRow = null;
    this.container = null;
    this.headerHeight = 0;
    this.headerMaxLScroll = 0;
    this.bodyMaxLScroll = 0;

    this.focusNext = this.focusNext.bind(this);
    this.handleFiniteScroll = this.handleFiniteScroll.bind(this);
    this.handleInfiniteScroll = this.handleInfiniteScroll.bind(this);
    this.updateDimensions = this.updateDimensions.bind(this);
    this.measureNewRows = this.measureNewRows.bind(this);
    this.measureColumns = this.measureColumns.bind(this);
    this.generateHeaders = this.generateHeaders.bind(this);
    this.updateAverageHeight = this.updateAverageHeight.bind(this);
    this.getRowClass = this.getRowClass.bind(this);
    this.handleRowClick = this.handleRowClick.bind(this);
    this.handleHeaderClick = this.handleHeaderClick.bind(this);
    this.getHeaderClassName = this.getHeaderClassName.bind(this);
    this.maybeSelected = this.maybeSelected.bind(this);
    this.backToTop = this.backToTop.bind(this);
    this.getMappedColumnName = this.getMappedColumnName.bind(this);
    this.getBodyStyle = this.getBodyStyle.bind(this);
    this.getContainerStyle = this.getContainerStyle.bind(this);
    this.initColumnsFromData = this.initColumnsFromData.bind(this);

    const columns = visibleColumns ? visibleColumns : 
        contentData.length > 0 ? this.initColumnsFromData() : null;

    this.state = {
      totalRows: contentData.length,
      contentTop: 0,
      firstIndex: scrollToIndex,
      amountToRender: 3,
      scrollTop: 0,
      overscanRows: 3,
      loading: false,
      columns,
      columnWidths: contentData.length > 0 ? this.measureColumns({columns}) : {},
      averageRowHeight: 0,
      adjustedHeight: null,
    }
  }

  componentDidMount(){
    // if by some mysterious occurence we actually have data when we mount...
    const newState = {};

    if(this.props.contentData.length > 0){
      if(!this.state.columns){
        this.state.columns = this.props.visibleColumns ? this.props.visibleColumns : this.initColumnsFromData();
        newState.columnWidths = this.measureColumns();
      }
      
      if(this.props.infinite){
        this.measureNewRows();
        const rowAvg = this.updateAverageHeight();
        newState.averageRowHeight = rowAvg;
        const dimensions = this.updateDimensions(this.props.height, this.props.contentData, rowAvg);
        Object.assign(newState, dimensions);
      } else {
        newState.amountToRender = this.props.contentData.length;
      }

      this.setState({...newState});

      this.headerHeight = this.headerRow.offsetHeight;
    }
  } 

  componentWillReceiveProps(nextProps){
    const newState = {};

    // sync number of rows...
    if(nextProps.contentData.length != this.props.contentData.length){
      newState.totalRows = nextProps.contentData.length;
      newState.loading = false;

      // if we just received data for the first time or after reset...
      if(this.props.contentData.length === 0){
        newState.columns = nextProps.visibleColumns ? nextProps.visibleColumns : this.initColumnsFromData(nextProps.contentData);
        newState.columnWidths = this.measureColumns({ data: nextProps.contentData, columns: newState.columns });
      }
    }

    this.setState({...newState});
  }

  componentDidUpdate(prevProps, prevState){
    // initial application of data, when data is first received or after reset...
    if(this.props.contentData.length > 0 && this.props.contentData.length !== prevProps.contentData.length) {
      
      requestAnimationFrame((e) => {
        this.measureNewRows();
        this.headerHeight = this.headerRow.offsetHeight;
      
        if(this.state.averageRowHeight === 0){
          const avg = this.updateAverageHeight();
          const dimensions = this.updateDimensions(this.props.height, this.props.contentData, avg);
          this.setState({averageRowHeight: avg, ...dimensions});
        }
      });
    }
    
    // if we have data available on first mounting, the averageRowHeight will have changed, so update accordingly
    if(prevState.averageRowHeight !== this.state.averageRowHeight){
      const dimensions = this.updateDimensions(this.props.height, this.props.contentData);
      this.setState({...dimensions});
    }

    if(prevProps.width != this.props.width && this.props.contentData.length > 0){
      this.headerHeight = this.headerRow.offsetHeight;
    }
  }

  updateDimensions(height, data, avgHeight){
    if(!avgHeight){
      avgHeight = this.state.averageRowHeight;
    }
    // if we don't have a height, then we'll just render whatever data we have...
    let newAmount;
    if(!height){
      newAmount = data.length;
    } else {
      newAmount = parseInt(height/avgHeight, 10) + (this.state.overscanRows * 2);
    }
    let fetching = false;

    //get at least 2 screens worth of data...
    if(data.length < newAmount * 2){
      if(this.props.infinite){
        this.props.onFetch();
        fetching = true;
      }
    }

    if(newAmount > data.length){ 
      newAmount = data.length;
    }

    const dimensions = {
      amountToRender: newAmount,
      loading: fetching,
    };

    return dimensions;
  }

  backToTop(){
    this.rowCache = [];
    this.setState({
      firstIndex: 0,
      contentTop: 0,
    });
  }

  handleFiniteScroll(e){
    this.headerRow.scrollLeft = e.target.scrollLeft;

    this.props.onScroll(e)
  }

  handleInfiniteScroll(e){
    const { averageRowHeight, scrollTop, amountToRender, totalRows, overscanRows, loading, adjustedHeight } = this.state;
    const currentScroll = e.target.scrollTop;
    const rowsPadding =  averageRowHeight * overscanRows;
    const nextState = { scrollTop: currentScroll };

    if(currentScroll > rowsPadding){
      // set position of rowContainer
      let topSpacer = (Math.ceil(currentScroll / averageRowHeight) * averageRowHeight) - averageRowHeight;
      topSpacer = topSpacer > 0 ? topSpacer : 0;
      nextState.contentTop = topSpacer;

      // calculate first index
      const rowsPast = topSpacer / averageRowHeight;
      nextState.firstIndex = Math.floor(rowsPast);

      // if we're 2 container-heights away (or less ) from the end of the data, fetch more...
      if(!this.state.loading && (rowsPast + (amountToRender * 2)) > totalRows){
        this.props.onFetch();
        nextState.loading = true;
      }

      if(rowsPast + amountToRender >= totalRows){
          requestAnimationFrame(() => {
            const rowsHeight = this.rowContainer.offsetHeight;
            this.setState((oldState) => {
              let newState = oldState;
              const newAdjustment = newState.contentTop + rowsHeight;
              if(newState.adjustedHeight === null || newAdjustment > newState.adjustedHeight){
                newState.adjustedHeight = newAdjustment;
              }
              return newState;
            })
          });
        
      } else {
        if(this.state.adjustedHeight !== null){
          nextState.adjustedHeight= null;
        }
      }
    }

    if(currentScroll < scrollTop){
      if(currentScroll < rowsPadding){
        nextState.firstIndex = 0;
        nextState.contentTop = 0;
      }
    }

    this.setState({
      ...nextState
    });

    this.headerRow.scrollLeft = e.target.scrollLeft;

    this.props.onScroll(e)
  }

  //Row logic

  measureNewRows(){
    if(this.rowContainer){// check for ref...
      const { firstIndex, amountToRender } = this.state;
      const { contentData } = this.props;
      const c = this.rowContainer.children;
      for(let i = 0; i < amountToRender; i++){
        const index = firstIndex + i;
        if(contentData[index]){
          if(this.rowCache[index] !== 'undefined'){
            // children are c[1] to c[length-1]
            this.rowCache.push(c[index - firstIndex].offsetHeight);
          }
        }
      }
    }
  }

  updateAverageHeight(){
    let sum = 0;
    this.rowCache.forEach((l) => {sum += l;});
    const avg = sum > 0 ? sum/this.rowCache.length : 0;
    //this.averageRowHeight = avg;
    return avg;
  }

  getRowClass(rowIndex){
    const selectedClass = this.props.selectedClass ? this.props.selectedClass : css.selected;
    return classnames(
      css.row,
      {[`${selectedClass}`]: this.maybeSelected(this.props.selectedRow, rowIndex)}
    );
  }

  handleRowClick(e, row, rowMeta){
    let meta = {};
    if(this.props.rowMetadata){
      this.props.rowMetadata.forEach(function(prop){
        meta[prop] = row[prop];
      }, this);
    }
    this.props.onRowClick(e, row);
  }

  maybeSelected(criteria, rowIndex){
    const row = this.props.contentData[rowIndex];
    let selected = criteria && Object.keys(criteria).length > 0;
    for(let prop in criteria){
      if(typeof(criteria[prop]) !== 'object'){
        if(criteria[prop] !== row[prop]){
          selected = false;
          break;
        }
      } else {
        if(!isEqual(criteria[prop], row[prop])){ 
          selected = false;
          break;
        }
      }
      
    }
    return selected;
  }

  renderCells(rowIndex){
    const { formatter, contentData, rowMetadata } = this.props;
    const { columnWidths } = this.state;

    const cells = [];
    this.state.columns.forEach((col) => {
      let value;
      if(formatter && formatter.hasOwnProperty(col)){
        value = formatter[col](contentData[rowIndex]);
      } else {
        value = contentData[rowIndex][col];
      }

      if(typeof(value) === 'object'){
        console.warn(`Possible Formatter needed - ${col} is an object`);
      }

      if(typeof(value) === 'boolean'){
        value = value ? (<span>&#10003;</span>) : '';
      }

      const cellWidth = columnWidths[col];
      const cellStyle = {flex: `0 0 ${cellWidth}px`};

      cells.push(
        <div 
          key={col} 
          className={css.cell}
          style={cellStyle}
        >
          {value}
        </div>
      );
    });

    return cells;
  }

  renderRow({rowIndex, rowClass, rowData, cells}){
    return (
      <div 
        key={`row-${rowIndex}`} 
        className={rowClass} 
        onClick={(e) => {this.handleRowClick(e, contentData[rowIndex], rowMetadata  )}}
        tabIndex="0"
      >
        {cells}
      </div>
    );
  }

  // Column Logic

  getMappedColumnName(column){
    const { columnMapping } = this.props;
    if(!columnMapping){
      return column;
    }

    if(columnMapping.hasOwnProperty(column)){
      return columnMapping[column];
    }

    return column;
  }

  getHeaderClassName(column){
    return classnames(
      css.header,
      {[`${css.sorted}`]: (this.props.sortOrder === this.getMappedColumnName(column) || this.props.sortedColumn === this.getMappedColumnName(column))},
      {[`${css.ascending}`]: (this.props.sortDirection == 'ascending')},
      {[`${css.descending}`]: (this.props.sortDirection == 'descending')}
    );
  }

  handleHeaderClick(e, name){
    const alias = this.props.columnMapping[name] || name;
    let meta = {name, alias};
    if(this.props.headerMetadata){
      for(let prop in this.props.headerMetadata[columnName]){
        meta[prop] = this.props.headerMetadata[columnName][prop];
      }
    }
    this.props.onHeaderClick(e, meta);
  }

  generateHeaders(){
    const { columnWidths } = this.state;
    const headers = [];
    this.state.columns.forEach((header, i) => {
      let headerWidth 
      if(i !== this.state.columns.length-1){
        headerWidth = columnWidths[header];
      } else {
        headerWidth = columnWidths[header] + 16;
      }
      const headerStyle = {flex: `0 0 ${headerWidth}px`};

      headers.push(
        <div key={`header-${header}`} onClick={(e)=>{this.handleHeaderClick(e, header)}} className={this.getHeaderClassName(header)} style={headerStyle}>
          {header}
        </div>
      );
    })
    return headers;
  }

  initColumnsFromData(data){
    //const {headerMetadata, rowMetadata, ...rest} = this.props;
    if(!data){ data = this.props.contentData;}
    let columns = [];
    for(let header in data[0]){
      //by default, hide rowMetadata and headerMetadata
      const hind = this.props.headerMetadata ? this.props.headerMetadata.indexOf(header) : -1;
      const rind = this.props.rowMetadata ? this.props.rowMetadata.indexOf(header) : -1;
      if(hind === -1 && rind === -1){
        columns.push(header);
      } 
    }
    return columns;
  }

  measureColumns({ data, columns } = {}){
    if(!data){data = this.props.contentData;}
    if(!columns){columns = this.state.columns;}
    const { columnWidths, visibleColumns, formatter } = this.props;
    let cellWidths = {};
    const cellPadding = 28;
    const charWidth = 9;

    columns.forEach((colName) => {
      if(typeof(columnWidths) !== 'undefined' && columnWidths.hasOwnProperty(colName)){
        cellWidths[colName] = columnWidths[colName];
      } else {
        //Measure column string contents...
        const charLengthArray = [];
        const headerWidth = colName.length * charWidth + cellPadding;
        data.forEach((row) => {
          let charLength = 25; //minimal char length
          if(formatter.hasOwnProperty(colName)){
            const res = formatter[colName](row);
            if(typeof(res) === 'string'){
              charLength = res.length;
            } else if(typeof(res) === 'number'){
              charLength = res.toString().length;
            } else if(typeof(res) === 'boolean'){
              charLength = 3;
            } else {
              if(React.isValidElement(res)){
                console.log(res);
              }
            }
          } else {
            charLength = row[colName].toString().length;
          }
          
          charLengthArray.push(charLength);
        });
        //getAverage width..
        let sum = 0;
        let width = 0;
        charLengthArray.forEach((len) => {sum += len;});
        if(sum !== 0 || charLengthArray.length !== 0){
          let avg = sum/charLengthArray.length;
          width = avg * charWidth + cellPadding; //character width and cell padding
          if(width < headerWidth){
            width = headerWidth;
          }
        } else {
          width = headerWidth;
        }
        cellWidths[colName] = width;
      }
    });

    return cellWidths;
  }

  focusNext(e){
    alert('focusNext');
    if(document.activeElement === this.container){
      this.rowContainer.firstChild.focus();
      return;
    }
  }

  getContainerStyle(){
    const containerStyle = {
      position: 'relative',
      overflow:'hidden',
    }

    if(this.props.autosize){
      containerStyle.height = '100%';
    }

    if(this.props.height){
      containerStyle.height = this.props.height;
    }

    if(!containerStyle.height){
      containerStyle.height = 'auto';
    }

    containerStyle.width = this.props.width || '100%';
    return containerStyle;
  }

  getBodyStyle(){
    const bodyStyle = {};
    // body will be scrollable if constrained in any way...
    if(this.props.autosize || this.props.height || this.props.maxHeight){
      bodyStyle.overflow = 'auto';
    }
    // if height is explicit, body height will be the remainder of the container aside from the header
    if(this.props.height) {
      bodyStyle.height = this.props.height - this.headerHeight;
    }

    // if we've only got a maxHeight to work with, the body max-height property will be set...
    if(this.props.maxHeight && !this.props.height){
      bodyStyle.maxHeight = this.props.maxHeight - this.headerHeight;
    }

    if(this.props.infinite){
      bodyStyle.maxHeight = this.props.maxHeight || 'none';
    }

    bodyStyle.width = this.props.width || '100%';

    return bodyStyle;
  }

  render(){
    const { firstIndex, amountToRender } = this.state;
    const { contentData, isEmptyMessage, rowMetadata } = this.props;

    //if contentData is empty, render empty message...
    if(contentData.length === 0){
      return <div className={css.emptyMessage} style={{minWidth:this.props.width||'200px'}}>{isEmptyMessage}</div>;
    }

    const renderedRows = [];

    for( let i = 0; i < amountToRender; i++){
      const rowIndex = firstIndex + i;
      if(contentData[rowIndex]){
        const cells = this.renderCells(rowIndex);
        const rowClass = this.getRowClass(rowIndex);
        const rowProps = this.props.rowProps || {onClick:(e) => {this.handleRowClick(e, contentData[rowIndex], rowMetadata)}};
        const row = this.props.rowFormatter({rowIndex, rowClass, rowData: this.props.contentData[rowIndex], cells, rowProps});
        renderedRows.push(row);
      } 
    }

    const renderedHeaders = this.generateHeaders();

    return (
        <div 
          style={this.getContainerStyle()} 
          tabIndex="0" 
          id={this.props.id}
          ref={(ref) => {this.container = ref}}
        >
          <div 
            className={css.headerRow} 
            ref={(ref) => {this.headerRow = ref;}}
            onScroll={this.handleHeaderScroll}
          >
            {renderedHeaders}
          </div>
          <div 
            className={css.scrollable} 
            style={this.getBodyStyle()}
            onScroll={this.props.infinite? this.handleInfiniteScroll : this.handleFiniteScroll}
            
          >
            { this.props.infinite && 
              <div className={css.heightSpacer} style={{ height: this.state.adjustedHeight || this.state.totalRows * this.state.averageRowHeight}}>
                <div className={css.rowContainer} style={{ top: this.state.contentTop }} ref={(ref) => {this.rowContainer = ref; this.measureNewRows();}}>
                  {renderedRows}
                </div>  
              </div>
            }
            { !this.props.infinite && 
              renderedRows
            }
            
          </div>
          {
            this.props.loading &&
            <div className={css.contentLoading}>
              <Icon icon='spinner-ellipsis' />
            </div>
          }
        </div>
    );
  }
}

MCLRenderer.propTypes = propTypes;
MCLRenderer.defaultProps = defaultProps;

export default MCLRenderer;