const express = require('express')
const session = require('express-session')
const MemoryStore = require('memorystore')(session);
const cookieParser = require('cookie-parser');
const app = express()
const port = 3000
const bodyParser = require('body-parser')
const path = require('path')
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const saltRounds = 10;
const { formatDate } = require('./util');
const { isDatePastTwoWeek,isDatePastTwoMonth,isDatePastOneMonth,isDatePast } = require('./util');
const { formatDateString } = require('./util');
const { findTime } = require('./util');
// 비밀번호 재설정용
const nodemailer = require('nodemailer');

app.use(cookieParser()); // cookie-parser 미들웨어 설정

require('dotenv').config();

const connection = mysql.createConnection({
  host     : process.env.DB_HOST,
  user     : process.env.DB_USER,
  password : process.env.DB_PASSWORD,
  database : process.env.DB_DATABASE
});

connection.connect((error) => {
  if (error) {
    console.error('MySQL 연결 실패:', error);
    throw error;
  }
  console.log('MySQL 연결 성공!');
});


// Nodemailer 설정
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_WORKS_HOST,
  port: process.env.EMAIL_WORKS_PORT,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_WORKS_USER,
    pass: process.env.EMAIL_WORKS_PASSWORD
  // service: process.env.EMAIL,
  // auth: {
  //   user: process.env.EMAIL_USER,
  //   pass: process.env.EMAIL_PASSWORD
  }
});
// 비밀번호 재설정 링크 생성 함수
function generateResetToken() {
  return crypto.randomBytes(20).toString('hex');
}
 
// connection.query('SELECT * FROM test.test_table', function (error, results, fields) {
//   if (error) throw error;
//   console.log('The solution is: ', results[0].solution);
// });

app.use(express.static(path.join(__dirname, 'public')));
//세션설정
app.use(session({ 
  store: new MemoryStore({
    checkPeriod: 24 * 60 * 60 * 1000 // 24시간
  }),
  secret: 'keyboard cat', 
  resave:false, 
  saveUninitialized:false,
  cookie: {
    secure: false, // HTTPS를 사용하는 경우 true로 설정
    maxAge: 24 * 60 * 60 * 1000 // 세션 만료 시간 (24시간)
  }
}))

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
  if (!req.session.user || req.session.user.userAccept === 0) {
    res.render('info');
    return;
  }

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
  if (req.session.user) {
    res.send("<script>alert('이미 로그인 되어 있습니다.'); history.go(-1);</script>");
  }else{
    const rememberId = req.cookies.rememberId || '';
    res.render('login',{cookie:rememberId})
  }
})

app.post('/loginProc', (req, res) => {
  const id  = req.body.userId.trim(); 
  const pw = req.body.userPassword.trim(); 
  const rememberId = req.body.rememberId;

  const sql = 'SELECT * FROM user WHERE `userID` = ?'      
  const values = [id]; 

  connection.query(sql, values, function (err, result){
      if(err) throw err; 

      if(result.length === 0) {
      res.send("<script>alert('아이디를 확인해주세요'); history.go(-1);</script>");
    } else {
      const user = result[0];
      // 비밀번호 비교
      bcrypt.compare(pw, user.userPW, (err, isMatch) => {
        if (err) {
          console.error('비밀번호 비교 오류:', err);
          res.send("<script>alert('서버 오류. 다시 시도해주세요.'); history.go(-1);</script>");
          return;
        }
        if (!isMatch) {
          res.send("<script>alert('비밀번호를 확인해주세요'); history.go(-1);</script>");
        } else {
          if (rememberId) {
            res.cookie('rememberId', id, { maxAge: 14 * 24 * 60 * 60 * 1000, httpOnly: true });
          } else {
            res.clearCookie('rememberId');
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
    req.session.destroy(err => {
      if (err) {
        return res.status(500).send('로그아웃 실패, 관리자에게 문의해주세요');
      }
    res.clearCookie('connect.sid');
    res.send("<script>alert('로그아웃 되었습니다.'); location.href='/';</script>");
    });
  });

app.post('/findIDProc', (req, res) => {
  const userPhone = req.body.userPhone;
  const sql = 'SELECT userID FROM user WHERE userPhone = ?';

  connection.query(sql, [userPhone], (err, results) => {
    if (err) {
      throw err;
    }  
    if (results.length > 0) {
      res.send(`아이디는 : ${results[0].userID} 입니다.`);
    } else {
      res.send('해당하는 아이디가 없습니다.');
    }
  });
});

app.get('/findID', function (req,res) {
  res.render('findID')
  }
);
// 임시 비밀번호 생성 함수 
// function generateTempPassword() {
//   return crypto.randomBytes(8).toString('hex'); // 16자리 임시 비밀번호 생성
// }

// 비밀번호 찾기 폼 렌더링
app.get('/findPassword', (req, res) => {
  res.render('findPassword');
});

// 비밀번호 찾기 처리
app.post('/request-password-reset', (req, res) => {
  const userID = req.body.userID.trim();
  const userEmail = req.body.userEmail.trim();

  const sql = 'SELECT * FROM user WHERE userID = ? AND userEmail = ?';

  connection.query(sql, [userID, userEmail], (err, results) => {
    if (err) {
      return res.status(500).send('Database query error');
    }
    if (results.length > 0) {
      const resetToken = generateResetToken();
      const resetExpires = Date.now() + 24 * 60 * 60 * 1000; // 24시간      
      const updateSql = 'UPDATE user SET resetToken = ?, resetExpires = ? WHERE userID = ?';
      connection.query(updateSql, [resetToken, resetExpires, userID], (err) => {
        if (err) {
          return res.status(500).send('Failed to update reset token');
        }
        const resetUrl = `http://${process.env.ADRESS}:${port}/reset-password?token=${resetToken}`;

        const mailOptions = {
          from: process.env.EMAIL_WORKS_USER,
          to: userEmail,
          subject: '비밀번호 재설정 요청',
          text: `비밀번호를 재설정하려면 다음 링크를 클릭하세요: ${resetUrl} \n ⚠️이 링크는 24시간 동안 유효합니다.`
        };

        transporter.sendMail(mailOptions, (error) => {
          if (error) {
            return res.status(500).send('Failed to send email');
          }
          res.send("<script>alert('비밀번호 재설정 링크가 이메일로 발송되었습니다.'); location.href='/login';</script>");
        });
      });
    } else {
      res.send("<script>alert('일치하는 사용자 정보가 없습니다.'); history.go(-1);</script>");
    }
  });
});
// 비밀번호 재설정 페이지 라우팅
app.get('/reset-password', (req, res) => {
  const { token } = req.query;

  const sql = 'SELECT * FROM user WHERE resetToken = ? AND resetExpires > ?';
  connection.query(sql, [token, Date.now()], (err, results) => {
    if (err) {
      return res.status(500).send('Database query error');
    }

    if (results.length > 0) {
      res.render('reset-password', { token });
    } else {
      res.send("<script>alert('비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다.😢'); location.href='/findPassword';</script>");
    }
  });
});

// 비밀번호 재설정 처리 라우팅
app.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  const sql = 'SELECT * FROM user WHERE resetToken = ? AND resetExpires > ?';

  connection.query(sql, [token, Date.now()], (err, results) => {
    if (err) {
      return res.status(500).send('Database query error');
    }
    if (results.length > 0) {
      const userId = results[0].userID;

      // 비밀번호 해시화
      bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
        if (err) {
          return res.status(500).send('Failed to hash password');
        }
        const updateSql = 'UPDATE user SET userPW = ?, resetToken = NULL, resetExpires = NULL WHERE userID = ?';
        connection.query(updateSql, [hashedPassword, userId], (err) => {
          if (err) {
            return res.status(500).send('Failed to update password');
          }
          res.send("<script>alert('비밀번호가 성공적으로 재설정되었습니다.'); location.href='/login';</script>");
        });
      });
    } else {
      res.send("<script>alert('비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다.😢'); location.href='/findPassword';</script>");
    }
  });
});

  app.get('/join', function (req, res) {
    if (req.session.user) {
      res.send("<script>alert('이미 로그인 되어 있습니다.'); history.go(-1);</script>");
    }else{    
      const sql = 'SELECT COUNT(*) AS totalUsers FROM user';
      let adminMessage = "";
      let adminID = "";
    
      connection.query(sql, (err, result) => {
        if (err) {
          throw err;
        }
        // 첫 유저인 경우 아이디 admin으로 지정 안내
        if (result[0].totalUsers === 0) {
          adminMessage = "최고관리자의 아이디는 'admin'으로 정해주세요";
          adminID='admin';
        }    
        // 쿼리 완료 후 응답을 렌더링
        res.render('join', { adminMessage: adminMessage, adminID:adminID });
      });
    }
  });

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
    let userAccept = 0; 

    const sql = 'SELECT COUNT(*) AS totalUsers FROM user';

    connection.query(sql, (err, result) => {
      if (err) throw err;
      // 첫 유저인 경우 userAccept 값을 1로 변경
      if (result[0].totalUsers === 0) {
        userAccept = 1;
        return;
      }
    })
      // 비밀번호 일치 확인
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
            res.send("<script>alert('등록되었습니다. 관리자 승인을 기다려주세요.'); location.href='/';</script>");
          });
        });
      }
    });
  });
  app.get('/userDelete/:NO', (req, res) => {
    const loggedInUser = req.session.user;
    //console.log("loggedInUser : "+JSON.stringify(loggedInUser))
    
    if (!loggedInUser) { //로그인 안했을 때
      res.send("<script>alert('로그인 해주세요.'); location.href='/';</script>");
      return;
    }
  
    const NO = req.params.NO; 
    // userNO가 1일때(최고관리자) 삭제 불가
    if (NO === '1') {
      res.send("<script>alert('최고관리자는 탈퇴 불가합니다.'); location.href='/';</script>");
      return;
    }
    
    // session의 usrNO가 파라미터의 NO와 다르거나(본인이 아니거나) 관리자가 아닌 경우
    if (loggedInUser.userNO != NO && loggedInUser.userRole !== 'admin') {
      res.send("<script>alert('권한이 없습니다.'); location.href='/';</script>");
      return;
    }
    
    const sql = 'DELETE FROM user WHERE `userNO` = ?';
  
    connection.query(sql, [NO], (err, result)=> {
      if(err) throw err;  
      if (loggedInUser.userNO == NO) {
        req.session.user = null;
        res.send("<script>alert('탈퇴가 완료되었습니다.'); location.href='/';</script>");
      }else{
        res.send("<script>alert('탈퇴가 완료되었습니다.'); location.href='/user';</script>");
      }
      })     
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
        res.send("<script>alert('수정되었습니다.'); location.href='/user';</script>");
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
  // userNO가 1일때(최종관리자), session의 userID가 'admin'이 아닌 경우 권한이 없다고 알림
  if (NO === '1' && loggedInUser.userID !== 'admin') {
    res.send("<script>alert('권한이 없습니다.'); location.href='/';</script>");
    return;
  }
  
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
    query = ` SELECT * FROM test_table WHERE \`delete\` = 0 AND LEAST(\`directorTerm\`, \`auditorTerm\`) > DATE_ADD(CURDATE(), INTERVAL 1 MONTH) AND LEAST(\`directorTerm\`, \`auditorTerm\`) <= DATE_ADD(CURDATE(), INTERVAL 2 MONTH) ORDER BY LEAST(\`directorTerm\`, \`auditorTerm\`) ASC; `;
    totalQuery = 'SELECT COUNT(*) AS totalCount FROM test_table WHERE \`delete\` = 0 AND LEAST(\`directorTerm\`, \`auditorTerm\`) > DATE_ADD(CURDATE(), INTERVAL 1 MONTH) AND LEAST(\`directorTerm\`, \`auditorTerm\`) <= DATE_ADD(CURDATE(), INTERVAL 2 MONTH);';
  }
  if (term == 'oneMonth'){
    query = ` SELECT * FROM test_table WHERE \`delete\` = 0 AND LEAST(\`directorTerm\`, \`auditorTerm\`) > DATE_ADD(CURDATE(), INTERVAL 2 WEEK) AND LEAST(\`directorTerm\`, \`auditorTerm\`) <= DATE_ADD(CURDATE(), INTERVAL 1 MONTH) ORDER BY LEAST(\`directorTerm\`, \`auditorTerm\`) ASC; `;
    totalQuery = ` SELECT COUNT(*) AS totalCount FROM test_table WHERE \`delete\` = 0 AND LEAST(\`directorTerm\`, \`auditorTerm\`) > DATE_ADD(CURDATE(), INTERVAL 2 WEEK) AND LEAST(\`directorTerm\`, \`auditorTerm\`) <= DATE_ADD(CURDATE(), INTERVAL 1 MONTH); `;
  }
  if (term == 'twoWeek'){
    query = ` SELECT * FROM test_table WHERE \`delete\` = 0 AND ( LEAST(\`directorTerm\`, \`auditorTerm\`) <= DATE_ADD(CURDATE(), INTERVAL 2 WEEK) OR LEAST(\`directorTerm\`, \`auditorTerm\`) < CURDATE() ) ORDER BY LEAST(\`directorTerm\`, \`auditorTerm\`) ASC; `;
    totalQuery = ` SELECT COUNT(*) AS totalCount FROM test_table WHERE \`delete\` = 0 AND ( LEAST(\`directorTerm\`, \`auditorTerm\`) <= DATE_ADD(CURDATE(), INTERVAL 2 WEEK) OR LEAST(\`directorTerm\`, \`auditorTerm\`) < CURDATE() ); `;
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

app.get('/sendmail/:id', (req, res) => {
  if (!req.session.user || req.session.user.userAccept === 0) {
    res.send("<script>alert('권한이 없습니다.'); location.href='/';</script>");
    return;
  }
  const id = req.params.id; 
  const sql = 'SELECT * FROM test_table WHERE `delete` = 0 AND `id` = ?';

  connection.query(sql, [id], (err, result)=> {
    if(err) throw err; 

    let auditorTerm = '';
    if(result[0].auditor || result[0].auditor !== null){
      auditorTerm = '감사임기 만료일 : ' + formatDate(result[0].auditorTerm);
    }
    let sendingText = `
      안녕하세요, 해피브릿지 입니다. \n ${result[0].corp}의 임기만료일 안내차 연락드렸습니다. \n\n 이사임기 만료일 : ${formatDate(result[0].directorTerm)} \n ${auditorTerm}           
      \n\n 그 외 법인 변경관련 안내문 보내드립니다. 업무 참고 부탁드립니다.
      \n\n - 법인변경등기 종류 -
      \n 1. 상호변경
      \n 2. 본점주소 변경
      \n 3. 자본금 변경(유상증자)
      \n 4. 발행주식 수 변경
      \n 5. 임원 변경 (임기만료/ 사임/ 취임/ 개명/ 사망 등)
      \n 6. 사업 목적 변경
      \n 7. 대표자의 주민등록등본상 주소
      \n - 신고기한 : 변경기준일로부터 2주 내
      \n\n 법인 변경등기 관련 문의사항은 하단 링크를 통해 연락주세요. 
      \n\n전화 : 02-1599-1873 / 이메일 : help@hb.re.kr / 카카오톡 : https://open.kakao.com/me/kidn
    `;

    const mailOptions = {
      from: process.env.EMAIL_WORKS_USER,
      to: result[0].email,
      subject: `${result[0].corp}의 임기만료일자 안내드립니다.`,
      text:  sendingText,
    };

    transporter.sendMail(mailOptions, (error) => {
      if (error) {
        return res.status(500).send('Failed to send email');
      }
      res.send("<script>alert('이메일이 발송되었습니다.'); history.go(-1);</script>");
    });
  });
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


app.get('/info', function (req,res) {
    res.render('info')
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