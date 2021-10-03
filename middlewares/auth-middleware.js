const jwt = require('jsonwebtoken')
const { User } = require('../models')

// 사용자 인증 미들웨어 구현
// 미들웨어 기본틀
module.exports = (req, res, next) => {
  // 토큰이 헤더에 포함된 상태
  const { authorization } = req.headers
  // 0인덱스=tokenType=Barer , 1인덱스=tokenValue=eyJh~~~
  const [tokenType, tokenValue] = authorization.split(' ')

  if (tokenType !== 'Bearer') {
    res.status(401).send({
      errorMessage: '로그인 후 이용하세요',
    })
    return
  }
  try {
    // value값인 uersId를 찾는다. jwt토큰이 유효한지 검증한다.
    const { userId } = jwt.verify(tokenValue, 'my-secret-key')
    // 진짜 Db에 있는 사용자인지 찾는다
    User.findByPk(userId).then((user) => {
      // asayc를 사용하지 않아 promise.then으로 사용하여 보내줌
      res.locals.user = user // 데이터베이스에서 사용자 정보를 가져오지 않게 하는 express가 제공하는 안전한 변수
      next() // 미들웨어는 반드시 next가 호출되어야 다음 미들웨어까지 연결할 수 있다.
    })

    // 만약 유저가 탈퇴했거나 다른이유로 없다면 이런 방법을 써야한다!!!
    //  if(!user) {
    //     res.status(401).send({
    //         errorMessage: '로그인 후 이용하세요',
    //  });
    //  return;
    //  }
  } catch (error) {
    res.status(401).send({
      errorMessage: '로그인 후 이용하세요',
    })
    return
  }
}
