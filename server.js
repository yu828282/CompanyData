const express = require('express')
const ejs = require('ejs') 
const app = express()
const port = 3000
const bodyParser = require('body-parser')
const session = require('express-session')
const path = require('path')
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { formatDate } = require('./util');
const { isDatePastTwoWeek,isDatePastTwoMonth,isDatePastOneMonth,isDatePast } = require('./util');
const { formatDateString } = require('./util');
const { findTime } = require('./util');

const cookieParser = require('cookie-parser');
app.use(cookieParser());

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
 
// connection.query('SELECT * FROM test.test_table', function (error, results, fields) {
//   if (error) throw error;
//   console.log('The solution is: ', results[0].solution);
// });

app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'keyboard cat', cookie: { maxAge: 60000 }, resave:true, saveUninitialized:true}))

app.use((req, res, next) => {
  // 모든 페이지에서 사용가능
  res.locals.userId = '';
  res.locals.name = '';
  res.locals.userNO = '';
  if(req.session.user){
    res.locals.userID = req.session.user.userID
    res.locals.userName = req.session.user.userName
    res.locals.userNO = req.session.user.userNO
  }
  next()
})

app.set('view engine','ejs') // ejs : html 안에서 javascript 를 쓸수있게 해주는 것
app.set('views', __dirname+'/views'); // 경로 설정 
app.use(bodyParser.urlencoded({ extended: false }))

// app.engine('html', require('ejs').renderFile); // 엔진설정

app.get('/', function (req,res) {
  let countTermEnd = 0;

  let query = 'SELECT * FROM test_table WHERE `delete` = 0 ORDER BY id DESC;';
  let totalQuery = 'SELECT COUNT(*) AS totalCount FROM test_table WHERE `delete` = 0';

  let totalUser = 'SELECT COUNT(*) AS totalUser FROM user';
  let newUser = 'SELECT COUNT(*) AS newUser FROM user Where `userAccept` = 0';

  connection.query(query, (err, results) => {
    if (err) {
      console.error('쿼리 실행 중 에러:', err);
      res.status(500).send('서버 오류');
      return;
    }   
    results.forEach(item => {
        if (isDatePastTwoMonth(formatDate(item.directorTerm)) || isDatePastTwoMonth(formatDate(item.auditorTerm))) {
            countTermEnd++;
        }
    })      
    connection.query(totalQuery, (err, totalCount) => {
      if (err) {
        console.error('전체 데이터 수 쿼리 실행 중 에러:', err);
        res.status(500).send('서버 오류');
        return;
      }       
      connection.query(totalUser, (err, totalUser) => {
        if (err) {
          res.status(500).send('서버 오류');
          return;
        }       
        connection.query(newUser, (err, newUser) => {
          if (err) {
            res.status(500).send('서버 오류');
            return;
          }   
        res.render('index',{lists:results, totalCount: totalCount[0].totalCount, countTermEnd:countTermEnd, totalUser:totalUser[0].totalUser, newUser:newUser[0].newUser})
        })
      });
    });
  });
});

app.get('/login', function (req,res) {
  const rememberedId = req.cookies.rememberedId || '';
  res.render('login',{cookie:rememberedId})
  }
)

app.post('/loginProc', (req, res) => {
  const id  = req.body.userId ; 
  const pw = req.body.userPassword; 
  const rememberId = req.body.rememberId;

  const sql = 'SELECT * FROM user WHERE `userID` = ?'      
  const values = [id]; 

  connection.query(sql, values, function (err, result){
      if(err) throw err; 

      if(result.length === 0) {
      res.send("<script>alert('아이디를 확인해주세요'); location.href='/login';</script>");
    } else {
      const user = result[0];
      // 비밀번호 비교
      bcrypt.compare(pw, user.userPW, (err, isMatch) => {
        if (err) {
          console.error('비밀번호 비교 오류:', err);
          res.send("<script>alert('서버 오류. 다시 시도해주세요.'); location.href='/login';</script>");
          return;
        }
        if (!isMatch) {
          res.send("<script>alert('비밀번호를 확인해주세요'); location.href='/login';</script>");
        } else {
          if (rememberId) {
            res.cookie('rememberedId', id, { maxAge: 14 * 24 * 60 * 60 * 1000, httpOnly: true });
          } else {
            res.clearCookie('rememberedId');
          }

          req.session.user = user;
          res.send("<script>alert('로그인 완료'); location.href='/';</script>");
        }
      });
    }
  });
});

app.get('/logout', (req, res) => {
    req.session.user = null;
    res.send("<script>alert('로그아웃 되었습니다.'); location.href='/';</script>");
  });

app.get('/join', function (req,res) {
      res.render('join')
    }
  )

app.get('/checkUserId', (req, res) => {
  const userId = req.query.userId;

  const sql = 'SELECT * FROM user WHERE userID = ?';
  const values = [userId];

  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error('쿼리 오류:', err);
      res.status(500).json({ error: '서버 오류' });
      return;
    }

    if (result.length > 0) {
      res.json({ exists: true });
    } else {
      res.json({ exists: false });
    }
  });
});

app.post('/joinProc', (req, res) => {
    const userID  = req.body.userID ; 
    const userPassword = req.body.userPassword; 
    const userPasswordcheck = req.body.userPasswordcheck; 
    const userName = req.body.userName; 
    const userPhone = req.body.userPhone; 
    const userEmail = req.body.userEmail; 
    const userRole = req.body.userRole; 
    const userAccept = 0; 

    if (userPassword !== userPasswordcheck) {
      res.send("<script>alert('비밀번호가 일치하지 않습니다.'); history.go(-1);</script>");
      return;
    }
    const checkSql = 'SELECT * FROM user WHERE userID = ?';
    const checkValues = [userID];

    connection.query(checkSql, checkValues, (err, result) => {
      if (err) {
        console.error('쿼리 오류:', err);
        res.send("<script>alert('데이터베이스 오류. 다시 시도해주세요.'); history.go(-1);</script>");
        return;
      }
  
      if (result.length > 0) {
        res.send("<script>alert('이미 존재하는 아이디입니다. 다른 아이디를 사용해주세요.'); history.go(-1);</script>");
      } else {
        // 비밀번호 해시 처리
        bcrypt.hash(userPassword, saltRounds, (err, hashedPassword) => {
          if (err) throw err;
  
          const insertSql = `INSERT INTO user(userID, userPW, userName, userPhone, userEmail, userRole, userAccept) VALUES (?, ?, ?, ?, ?, ?, ?)`;
          const insertValues = [userID, hashedPassword, userName, userPhone, userEmail, userRole, userAccept];
  
          connection.query(insertSql, insertValues, (err, result) => {
            if (err) throw err;
            res.send("<script>alert('등록되었습니다.'); location.href='/';</script>");
          });
        });
      }
    });
  });

  app.get('/mypage', function (req,res) {
    const loggedInUser = req.session.user;
    
    if (!loggedInUser) {
      res.send("<script>alert('권한이 없습니다.'); location.href='/login';</script>");
      return;
    }
  
    const userNO = req.session.user.userNO;
    const sql = 'SELECT * FROM user WHERE userNO = ?';

    connection.query(sql, [userNO], (err, results) => {
      if (err) {
        res.status(500).send('서버 오류');
        return;
      }   
        res.render('mypage',{user:results[0]})
      }
    )
  });

  app.post('/updateUser', (req, res) => {
    const loggedInUser = req.session.user;
    const userNO = parseInt(req.query.userNO, 10);
    
    if (!loggedInUser || (userNO !== loggedInUser.userNO && loggedInUser.userRole !== 'admin')) {
      res.send("<script>alert('권한이 없습니다.'); location.href='/';</script>");
      return;
    }

    const { userID, userName, userPhone, userEmail, userRole, userPassword, userPasswordcheck, userAccept} = req.body;
  
    if (userPassword && userPassword !== userPasswordcheck) {
      res.send("<script>alert('비밀번호가 일치하지 않습니다.'); history.go(-1);</script>");
      return;
    }          
        
    if (userPassword) {
      // 비밀번호가 제공된 경우, 비밀번호 해시 처리
      bcrypt.hash(userPassword, saltRounds, (err, hashedPassword) => {
        if (err) throw err;
        const sql = `UPDATE user SET userName = ?, userPhone = ?, userEmail = ?, userRole = ?, userPW = ? WHERE userNO = ?`;
        const values = [userName, userPhone, userEmail, userRole, hashedPassword, userNO];
  
        connection.query(sql, values, (err, result) => {
          if (err) throw err;
          res.send("<script>alert('수정되었습니다.'); location.href='/';</script>");
        });
      });
    } else {
      // 비밀번호가 제공되지 않은 경우, 비밀번호를 제외한 다른 정보 업데이트
      const sql = `UPDATE user SET userName = ?, userPhone = ?, userEmail = ?, userRole = ?, userAccept=? WHERE userNO = ?`;
      const values = [userName, userPhone, userEmail, userRole, userAccept, userNO];
  
      connection.query(sql, values, (err, result) => {
        if (err) throw err;
        res.send("<script>alert('수정되었습니다.'); location.href='/';</script>");
      });
    }
  });

app.get('/userDetail/:NO', (req, res) => {
  const loggedInUser = req.session.user;
  
  if (!loggedInUser || loggedInUser.userAccept === 0 || loggedInUser.userRole !== 'admin') {
    res.send("<script>alert('권한이 없습니다.'); location.href='/';</script>");
    return;
  }

  const NO = req.params.NO; 
  const sql = 'SELECT * FROM user WHERE `userNO` = ?';

  connection.query(sql, [NO], (err, result)=> {
    if(err) throw err;  
    res.render('userDetail',{NO:NO, user: result[0]})
    })     
  });

app.get('/user', function (req,res) {
  const loggedInUser = req.session.user;
  
  if (!loggedInUser || loggedInUser.userAccept === 0 || loggedInUser.userRole !== 'admin') {
    res.send("<script>alert('권한이 없습니다.'); location.href='/';</script>");
    return;
  }
  const currentPage = parseInt(req.query.currentPage) || 1;
  const pageSize = 10;
  const startIdx = (currentPage - 1) * pageSize;
  const query = 'SELECT * FROM user ORDER BY userNO;';
  const totalQuery = 'SELECT COUNT(*) AS totalCount FROM user'; 
  connection.query(query, [startIdx, pageSize], (err, results) => {
    if (err) {
      res.status(500).send('서버 오류');
      return;
    }       
    connection.query(totalQuery, (err, totalCount) => {
      if (err) {
        res.status(500).send('서버 오류');
        return;
      }   
      res.render('user',{lists:results, totalCount: totalCount[0].totalCount, currentPage: currentPage, pageSize:pageSize})
    }
  )
  });
});

app.get('/profile', function (req,res) {
  if (!req.session.user ||  req.session.user.userAccept === 0) {
    res.send("<script>alert('권한이 없습니다.'); location.href='/';</script>");
    return;
  }

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
  if (term == 'twoMonth'){
    query = 'SELECT * FROM test_table WHERE `delete` = 0 AND ( LEAST(`directorTerm`, `auditorTerm`) > DATE_ADD(CURDATE(), INTERVAL 1 MONTH) AND LEAST(`directorTerm`, `auditorTerm`) <= DATE_ADD(CURDATE(), INTERVAL 2 MONTH) ) ORDER BY LEAST(`directorTerm`, `auditorTerm`) ASC;';
    totalQuery = 'SELECT COUNT(*) AS totalCount FROM test_table WHERE `delete` = 0 AND ( LEAST(`directorTerm`, `auditorTerm`) > DATE_ADD(CURDATE(), INTERVAL 1 MONTH) AND LEAST(`directorTerm`, `auditorTerm`) <= DATE_ADD(CURDATE(), INTERVAL 2 MONTH) );';
  }
  if (term == 'oneMonth'){
    query = 'SELECT * FROM test_table WHERE `delete` = 0 AND ( LEAST(`directorTerm`, `auditorTerm`) > DATE_ADD(CURDATE(), INTERVAL 2 WEEK) AND LEAST(`directorTerm`, `auditorTerm`) <= DATE_ADD(CURDATE(), INTERVAL 1 MONTH) ) ORDER BY LEAST(`directorTerm`, `auditorTerm`) ASC;';
    totalQuery = 'SELECT COUNT(*) AS totalCount FROM test_table WHERE `delete` = 0 AND ( LEAST(`directorTerm`, `auditorTerm`) > DATE_ADD(CURDATE(), INTERVAL 2 WEEK) AND LEAST(`directorTerm`, `auditorTerm`) <= DATE_ADD(CURDATE(), INTERVAL 1 MONTH) );';
  }
  if (term == 'twoWeek'){
    query = 'SELECT * FROM test_table WHERE `delete` = 0 AND ( LEAST(`directorTerm`, `auditorTerm`) <= DATE_ADD(CURDATE(), INTERVAL 2 WEEK) AND LEAST(`directorTerm`, `auditorTerm`) < CURDATE() ) ORDER BY LEAST(`directorTerm`, `auditorTerm`) ASC;';
    totalQuery = 'SELECT COUNT(*) AS totalCount FROM test_table WHERE `delete` = 0 AND ( LEAST(`directorTerm`, `auditorTerm`) <= DATE_ADD(CURDATE(), INTERVAL 2 WEEK) AND LEAST(`directorTerm`, `auditorTerm`) < CURDATE() );';
  }
  connection.query(query, (err, results) => {
    if (err) {
      console.error('쿼리 실행 중 에러:', err);
      res.status(500).send('서버 오류');
      return;
    }   
    results.forEach(item => {
        if (isDatePastTwoMonth(formatDate(item.directorTerm)) || isDatePastTwoMonth(formatDate(item.auditorTerm))) {
            countTermEnd++;
        }
    });
  
    
    connection.query(totalQuery, (err, totalCount) => {
      if (err) {
        console.error('전체 데이터 수 쿼리 실행 중 에러:', err);
        res.status(500).send('서버 오류');
        return;
      }   
      res.render('profile',{lists:results, totalCount: totalCount[0].totalCount, currentPage: currentPage, searchWord: searchWord, term: term,countTermEnd:countTermEnd, formatDate, isDatePastTwoWeek, isDatePastTwoMonth,isDatePastOneMonth, isDatePast})
    }
  )

  });
});

app.get('/profile/:currentPage', (req, res) => {
  if (!req.session.user || req.session.user.userAccept === 0) {
    res.send("<script>alert('권한이 없습니다.'); location.href='/';</script>");
    return;
  }
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
  if (term == 'twoMonth'){
    query = 'SELECT * FROM test_table WHERE `delete` = 0 AND ( LEAST(`directorTerm`, `auditorTerm`) > DATE_ADD(CURDATE(), INTERVAL 1 MONTH) AND LEAST(`directorTerm`, `auditorTerm`) <= DATE_ADD(CURDATE(), INTERVAL 2 MONTH) ) ORDER BY LEAST(`directorTerm`, `auditorTerm`) ASC;';
    totalQuery = 'SELECT COUNT(*) AS totalCount FROM test_table WHERE `delete` = 0 AND ( LEAST(`directorTerm`, `auditorTerm`) > DATE_ADD(CURDATE(), INTERVAL 1 MONTH) AND LEAST(`directorTerm`, `auditorTerm`) <= DATE_ADD(CURDATE(), INTERVAL 2 MONTH) );';
  }
  if (term == 'oneMonth'){
    query = 'SELECT * FROM test_table WHERE `delete` = 0 AND ( LEAST(`directorTerm`, `auditorTerm`) > DATE_ADD(CURDATE(), INTERVAL 2 WEEK) AND LEAST(`directorTerm`, `auditorTerm`) <= DATE_ADD(CURDATE(), INTERVAL 1 MONTH) ) ORDER BY LEAST(`directorTerm`, `auditorTerm`) ASC;';
    totalQuery = 'SELECT COUNT(*) AS totalCount FROM test_table WHERE `delete` = 0 AND ( LEAST(`directorTerm`, `auditorTerm`) > DATE_ADD(CURDATE(), INTERVAL 2 WEEK) AND LEAST(`directorTerm`, `auditorTerm`) <= DATE_ADD(CURDATE(), INTERVAL 1 MONTH) );';
  }
  if (term == 'twoWeek'){
    query = 'SELECT * FROM test_table WHERE `delete` = 0 AND ( LEAST(`directorTerm`, `auditorTerm`) <= DATE_ADD(CURDATE(), INTERVAL 2 WEEK) AND LEAST(`directorTerm`, `auditorTerm`) < CURDATE() ) ORDER BY LEAST(`directorTerm`, `auditorTerm`) ASC;';
    totalQuery = 'SELECT COUNT(*) AS totalCount FROM test_table WHERE `delete` = 0 AND ( LEAST(`directorTerm`, `auditorTerm`) <= DATE_ADD(CURDATE(), INTERVAL 2 WEEK) AND LEAST(`directorTerm`, `auditorTerm`) < CURDATE() );';
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
        if (isDatePastTwoMonth(formatDate(item.directorTerm)) || isDatePastTwoMonth(formatDate(item.auditorTerm))) {
            countTermEnd++;
        }
    });    
    connection.query(totalQuery, searchWord ? searchParams : [], (err, totalCount) => {
      if (err) {
        console.error('전체 데이터 수 쿼리 실행 중 에러:', err);
        res.status(500).send('서버 오류');
        return;
      }   
      res.render('profile',{lists:results, totalCount: totalCount[0].totalCount, currentPage: currentPage, searchWord: searchWord, term: term,countTermEnd:countTermEnd, formatDate, isDatePastTwoWeek, isDatePastTwoMonth,isDatePastOneMonth, isDatePast})
    }
  )

  });
});

app.get('/register', (req, res) => {
  if (!req.session.user || req.session.user.userAccept === 0) {
    res.send("<script>alert('권한이 없습니다.'); location.href='/';</script>");
    return;
  }
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
  if (!req.session.user || req.session.user.userAccept === 0) {
    res.send("<script>alert('권한이 없습니다.'); location.href='/';</script>");
    return;
  } 
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
  if (!req.session.user || req.session.user.userAccept === 0) {
    res.send("<script>alert('권한이 없습니다.'); location.href='/';</script>");
    return;
  }
  const id = req.query.id
  const sql = `UPDATE test_table SET \`delete\` = '1' WHERE \`id\` = '${id}'`;
  //var sql = `delete from test_table where id='${id}' `
  connection.query(sql, function (err, result){
     if(err) throw err; 
     
     res.send("<script> alert('삭제되었습니다.'); location.href='/profile';</script>"); 
 })
});

app.get('/detail/:id', (req, res) => {
  if (!req.session.user || req.session.user.userAccept === 0) {
    res.send("<script>alert('권한이 없습니다.'); location.href='/';</script>");
    return;
  }
  const id = req.params.id; 
  const kakaoAppKey = process.env.KAKAO_API; // 환경 변수 사용
  const currentPage = req.query.currentPage || 1; ; // currentPage에 전달된 값이 할당됨
  const sql = 'SELECT * FROM test_table WHERE `delete` = 0 AND `id` = ?';
  const commentSql = 'SELECT * FROM comment WHERE `delete` = 0 AND `corpid` = ? ORDER BY commentId DESC';
  const totalCommentSql = 'SELECT COUNT(*) AS totalCount FROM comment WHERE `delete` = 0 AND `corpid` = ?';

  connection.query(sql, [id], (err, result)=> {
    if(err) throw err; 
    connection.query(commentSql, [id],  (err, comments) => {
      if (err) throw err; 
      connection.query(totalCommentSql, [id], (err, totalCount) => {
        if (err) throw err; 
        res.render('detail',{id:id, list: result, commentLists : comments, totalCount :totalCount, currentPage:currentPage, formatDate, isDatePastTwoWeek, isDatePastTwoMonth,isDatePastOneMonth, formatDateString, findTime, kakaoAppKey, isDatePast})
      }
      )     
    }
  )
 })
});

app.post('/makeComment', (req, res) => {
  if (!req.session.user || req.session.user.userAccept === 0) {
    res.send("<script>alert('권한이 없습니다.'); location.href='/';</script>");
    return;
  }
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
      res.redirect(`/detail/${corpid}`);
  })
})

app.get('/commentDelete', (req, res) => {
  if (!req.session.user || req.session.user.userAccept === 0) {
    res.send("<script>alert('권한이 없습니다.'); location.href='/';</script>");
    return;
  }
  const commentId = req.query.id
  const corpId = req.query.corpid
  const sql = `UPDATE comment SET \`delete\` = '1' WHERE \`commentId\` = ?`;

  connection.query(sql, [commentId], (err, results) => {
    if (err) throw err;     
        res.redirect(`/detail/${corpId}`);
  });
});

app.post('/updateComment', (req, res) => {
  if (!req.session.user || req.session.user.userAccept === 0) {
    res.send("<script>alert('권한이 없습니다.'); location.href='/';</script>");
    return;
  }
  const commentId = req.query.id;  
  const corpId = req.query.corpid;

  const contact  = req.body.contact ; 
  const date = req.body.date; 
  const time = req.body.time || '00:00'; 
  const user = req.body.user; 
  const title = req.body.title; 
  const memo = req.body.memo; 
  const datetime = `${date} ${time}`;
  
  const sql = `UPDATE comment SET contact = ?, date = ?, user = ?, title = ?, memo = ? WHERE commentId = ?`;
  const values = [contact, datetime, user, title, memo, commentId];

  connection.query(sql, values, (err, results) => {
    if (err) throw err;     
        res.redirect(`/detail/${corpId}`);
  });
});


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