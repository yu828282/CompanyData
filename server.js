const express = require('express')
const ejs = require('ejs') 
const app = express()
const port = 3000
const bodyParser = require('body-parser')
const path = require('path')
const mysql = require('mysql');
const moment = require('moment');

const { formatDate } = require('./util');
const { isDatePast } = require('./util');
const { formatDateString } = require('./util');

require('dotenv').config();

const connection = mysql.createConnection({
  host     : 'localhost',
  user     : process.env.DB_USER,
  password : process.env.DB_PASSWORD,
  database : 'test'
});

connection.connect((error) => {
  if (error) {
    console.error('MySQL 연결 실패:', error);
    throw error;
  }
  console.log('MySQL 연결 성공!');
});
 
connection.query('SELECT * FROM test.test_table', function (error, results, fields) {
  if (error) throw error;
  console.log('The solution is: ', results[0].solution);
});

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine','ejs') // ejs : html 안에서 javascript 를 쓸수있게 해주는 것
app.set('views', __dirname+'/views'); // 경로 설정 
app.use(bodyParser.urlencoded({ extended: false }))

// app.engine('html', require('ejs').renderFile); // 엔진설정

app.get('/', function (req,res) {
  let countTermEnd = 0;

  let query = 'SELECT * FROM test_table WHERE `delete` = 0 ORDER BY id DESC;';
  let totalQuery = 'SELECT COUNT(*) AS totalCount FROM test_table WHERE `delete` = 0';

  connection.query(query, (err, results) => {
    if (err) {
      console.error('쿼리 실행 중 에러:', err);
      res.status(500).send('서버 오류');
      return;
    }   
    results.forEach(item => {
        if (isDatePast(formatDate(item.directorTerm)) || isDatePast(formatDate(item.auditorTerm))) {
            countTermEnd++;
        }
    });  
    
    connection.query(totalQuery, (err, totalCount) => {
      if (err) {
        console.error('전체 데이터 수 쿼리 실행 중 에러:', err);
        res.status(500).send('서버 오류');
        return;
      }   
      res.render('index',{lists:results, totalCount: totalCount[0].totalCount, countTermEnd:countTermEnd})
    }
  )

  });
});

app.get('/term', function (req,res) {
  const currentPage = parseInt(req.query.currentPage) || 1;
  const pageSize = 10;
  const startIdx = (currentPage - 1) * pageSize;
  let countTermEnd = 0;

  const query = 'SELECT * FROM test_table WHERE `delete` = 0 ORDER BY LEAST(directorTerm, auditorTerm) ASC;';
  const totalQuery = 'SELECT COUNT(*) AS totalCount FROM test_table WHERE `delete` = 0'; 
  connection.query(query, [startIdx, pageSize], (err, results) => {
    if (err) {
      res.status(500).send('서버 오류');
      return;
    }   
    results.forEach(item => {
        if (isDatePast(formatDate(item.directorTerm)) || isDatePast(formatDate(item.auditorTerm))) {
            countTermEnd++;
        }
    });
    
    connection.query(totalQuery, (err, totalCount) => {
      if (err) {
        res.status(500).send('서버 오류');
        return;
      }   
      res.render('term',{lists:results, totalCount: totalCount[0].totalCount, currentPage: currentPage, countTermEnd: countTermEnd, pageSize:pageSize})
    }
  )

  });
});


app.get('/profile', function (req,res) {
  let countTermEnd = 0;
  const currentPage = req.params.currentPage || 1; ; // currentPage에 전달된 값이 할당됨
  const searchWord = req.query.searchWord || ''; // 쿼리 문자열에서 검색어 가져오기    
  const term = req.query.term || ''; // 쿼리 문자열에서 term 가져오기  
  let query = 'SELECT * FROM test_table WHERE `delete` = 0 ORDER BY id DESC';
  let totalQuery = 'SELECT COUNT(*) AS totalCount FROM test_table WHERE `delete` = 0';

  if (term){
    query = 'SELECT * FROM test_table WHERE `delete` = 0 ORDER BY LEAST(directorTerm, auditorTerm) ASC;';
  }
  if (term == 'director'){
    query = 'SELECT * FROM test_table WHERE `delete` = 0 ORDER BY directorTerm ASC;';
  }
  if (term == 'auditor'){
    query = 'SELECT * FROM test_table WHERE `delete` = 0 ORDER BY auditorTerm ASC;';
  }
  connection.query(query, (err, results) => {
    if (err) {
      console.error('쿼리 실행 중 에러:', err);
      res.status(500).send('서버 오류');
      return;
    }   
    results.forEach(item => {
        if (isDatePast(formatDate(item.directorTerm)) || isDatePast(formatDate(item.auditorTerm))) {
            countTermEnd++;
        }
    });
  
    
    connection.query(totalQuery, (err, totalCount) => {
      if (err) {
        console.error('전체 데이터 수 쿼리 실행 중 에러:', err);
        res.status(500).send('서버 오류');
        return;
      }   
      res.render('profile',{lists:results, totalCount: totalCount[0].totalCount, currentPage: currentPage, searchWord: searchWord, term: term,countTermEnd:countTermEnd, formatDate, isDatePast})
    }
  )

  });
});

app.get('/profile/:currentPage', (req, res) => {
  let countTermEnd = 0;
  const currentPage = req.params.currentPage || 1; ; // currentPage에 전달된 값이 할당됨
  const searchWord = req.query.searchWord || ''; // 쿼리 문자열에서 검색어 가져오기    
  const term = req.query.term || ''; // 쿼리 문자열에서 term 가져오기  

  let query = 'SELECT * FROM test_table WHERE `delete` = 0 ORDER BY id DESC';
  let totalQuery = 'SELECT COUNT(*) AS totalCount FROM test_table WHERE `delete` = 0';  

  if (searchWord) {
    query = 'SELECT * FROM test_table WHERE `delete` = 0 AND (corp LIKE ? OR manager LIKE ? OR phone LIKE ? OR email LIKE ?) ORDER BY id DESC';
    totalQuery = 'SELECT COUNT(*) AS totalCount FROM test_table WHERE `delete` = 0 AND (corp LIKE ? OR manager LIKE ? OR phone LIKE ? OR email LIKE ?)';
}
  if (term){
    query = 'SELECT * FROM test_table WHERE `delete` = 0 ORDER BY LEAST(directorTerm, auditorTerm) ASC;';
  }
  if (term == 'director'){
    query = 'SELECT * FROM test_table WHERE `delete` = 0 ORDER BY directorTerm ASC;';
  }
  if (term == 'auditor'){
    query = 'SELECT * FROM test_table WHERE `delete` = 0 ORDER BY auditorTerm ASC;';
  }

const searchParams = [`%${searchWord}%`, `%${searchWord}%`, `%${searchWord}%`, `%${searchWord}%`];
const countParams = [`%${searchWord}%`, `%${searchWord}%`, `%${searchWord}%`, `%${searchWord}%`];

  connection.query(query, searchWord ? countParams : [], (err, results) => {
    if (err) {
      console.error('쿼리 실행 중 에러:', err);
      res.status(500).send('서버 오류');
      return;
    }   
    results.forEach(item => {
        if (isDatePast(formatDate(item.directorTerm)) || isDatePast(formatDate(item.auditorTerm))) {
            countTermEnd++;
        }
    });    
    connection.query(totalQuery, searchWord ? searchParams : [], (err, totalCount) => {
      if (err) {
        console.error('전체 데이터 수 쿼리 실행 중 에러:', err);
        res.status(500).send('서버 오류');
        return;
      }   
      res.render('profile',{lists:results, totalCount: totalCount[0].totalCount, currentPage: currentPage, searchWord: searchWord, term: term,countTermEnd:countTermEnd, formatDate, isDatePast})
    }
  )

  });
});

app.get('/register', (req, res) => {
  res.render('register')  
})

app.post('/registerProc', (req, res) => {
   const corp  = req.body.corp ; 
   const date = req.body.date; 
   const eDate = req.body.eDate; 
   const manager = req.body.manager; 
   const phone = req.body.phone; 
   const email = req.body.email; 
   const auditor = req.body.auditor; 
   const closing = req.body.closing; 
   const directorTerm = req.body.directorTerm; 
   const auditorTerm = req.body.auditorTerm; 
   const memo = req.body.memo; 

   var sql = `insert into test_table(corp,date,eDate,manager,phone,email,auditor,closing,directorTerm,auditorTerm,memo) values(?,?,?,?,?,?,?,?,?,?,?)`
    
   var values = [corp,date,eDate,manager,phone,email,auditor,closing,directorTerm,auditorTerm,memo]; 

   connection.query(sql, values, function (err, result){
       if(err) throw err; 
       console.log('자료 1개를 삽입하였습니다.');
       res.send("<script> alert('등록되었습니다.'); location.href='/';</script>"); 
   })
})

app.get('/search', (req, res) => {
    const searchWord = req.query.query;
    res.redirect(`/profile/1?searchWord=${searchWord}`);
});

app.post('/updateForm', (req, res) => {
  const id = req.query.id;
  const {corp,date,eDate,manager,phone,email,auditor,closing,directorTerm,auditorTerm,memo} = req.body;
  if (!id) { return res.status(400).send('ID is required'); }

  const sql = `UPDATE test_table SET corp = ?,date = ?, eDate = ?, manager = ?, phone = ?, email = ?, auditor = ?, closing = ?, directorTerm = ?, auditorTerm = ?, memo = ? WHERE id = ?`;
  const values = [corp, date, eDate, manager, phone, email, auditor, closing, directorTerm, auditorTerm, memo, id];

  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error updating record:', err);
      res.status(500).send('Internal Server Error');
    }
    res.send("<script>alert('수정이 완료되었습니다.'); location.href='/profile';</script>");
  });
});

app.get('/profileDelete', (req, res) => {
  const id = req.query.id
  const sql = `UPDATE test_table SET \`delete\` = '1' WHERE \`id\` = '${id}'`;
  //var sql = `delete from test_table where id='${id}' `
  connection.query(sql, function (err, result){
     if(err) throw err; 
     
     res.send("<script> alert('삭제되었습니다.'); location.href='/profile';</script>"); 
 })
});

app.get('/detail/:id', (req, res) => {
  const id = req.params.id;
  const sql = 'SELECT * FROM test_table WHERE `delete` = 0 AND `id` = ?';
  const commentSql = 'SELECT * FROM comment WHERE `delete` = 0 AND `corpid` = ? ORDER BY commentId DESC';
  const totalCommentSql = 'SELECT COUNT(*) AS totalCount FROM comment WHERE `delete` = 0 AND `corpid` = ?';

  connection.query(sql, [id], (err, result)=> {
     if(err) throw err; 

     connection.query(commentSql, [id],  (err, comments) => {
       if (err) throw err; 

       connection.query(totalCommentSql, [id], (err, toalComment) => {
         if (err) throw err; 
         res.render('detail',{list: result, commentLists : comments, totalComment :toalComment, formatDate, isDatePast, formatDateString})
        }
       )     
      }
    )
 })
});


app.post('/makeComment', (req, res) => {
  const corpid = req.query.id
  const contact  = req.body.contact ; 
  const date = req.body.date; 
  const time = req.body.time || '00:00'; 
  const user = req.body.user; 
  const title = req.body.title; 
  const memo = req.body.memo; 

  const datetime = `${date} ${time}`;

  var sql = `insert into comment(corpid,contact,date,user,title,memo) values(?,?,?,?,?,?)`
   
  var values = [corpid,contact,datetime,user,title,memo]; 

  connection.query(sql, values, function (err, result){
      if(err) throw err; 
      console.log('자료 1개를 삽입하였습니다.');
      res.send("<script> alert('등록되었습니다.'); location.href=history.back();</script>"); 
  })
})



app.listen(port, () => {
    console.log(`Start Server : localhost : ${port}`)
    });

 
// connection.end((error) => {
//   if (error) {
//     console.error('MySQL 연결 해제 실패:', error);
//     throw error;
//   }
//   console.log('MySQL 연결이 해제되었습니다.');
// });