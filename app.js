const express = require('express')
const Http = require('http')
const socketIo = require('socket.io')
const { Op } = require('sequelize')
const { User, Cart, Goods } = require('./models')
const authMiddleware = require('./middlewares/auth-middleware')
const jwt = require('jsonwebtoken')
// const Joi = require("joi");

const app = express()
const http = Http.createServer(app) // express서버를 받아서 http 서버로 래핑한다
const io = socketIo(http)
const router = express.Router()

io.on('connection', (socket) => {
  // io는 모든 socket을 관리해준다
  console.log('누군가 연결했어요!')

  socket.on('BUY', (data) => {
    const payload = {
      nickname: data.nickname,
      goodsId: data.goodsId,
      goodsName: data.goodsName,
      date: new Date().toISOString(),
    }
    console.log('클라이언트가 구매한 데이터', data, new Date())
    io.emit('BUY_GOODS', payload) // io에 emit을 하면 전체에 다 뿌린다
    // socket.broadcast.emit('BUY_GOODS', payload) -> 나를 제외한 모두에게 뿌린다
    // 내 계정으로 로그인했다고 내 socket이 하나인건 아니다
  })

  socket.on('disconnect', () => {
    console.log('누군가 연결을 끊었어요!')
  })
})

// Joi로 입력값 검증 (회원가입)
// const postUsersSchema = Joi.object({
//     nickname: Joi.string().required(),
//     email: Joi.string().email().required(),
//     password: Joi.string().required(),
// })

// 회원가입 api (사용자 유효성 검사 필요)
router.post('/users', async (req, res) => {
  try {
    // 에러가 나는 경우 대비
    const { nickname, email, password, confirmPassword } = req.body

    if (password !== confirmPassword) {
      // 400보다 낮은값은 성공
      res.status(400).send({
        errorMessage: '패스워가 패스워드 확인란과 동일하지 않습니다.',
      })
      return // return 해주야 error가 맞아도 스코프 밖으로 나가지 않는다
    }
    // 시퀄라이즈 or연산자 작성법
    const existUsers = await User.findAll({
      where: {
        [Op.or]: [{ nickname }, { email }],
      },
    })
    if (existUsers.length) {
      // 왜 .length를 붙이지...?
      res.status(400).send({
        errorMessage: '이미 가입된 이메일 또는 닉네임이 있습니다.',
      })
      return
    }
    // 이제 다 걸러내고 DB에 새로운 user를 저장한다
    await User.create({ email, nickname, password })
    // send만 적으면 200 값을 반환. 회원가입 완료 후 응답값으로 할게 없으니 안준다
    // create는 status 201이라는 코드가 적함
    res.status(201).send({})
  } catch (error) {
    res.status(400).send({
      errorMessage: '요청한 데이터 형식이 올바르지 않습니다',
    })
  }
})

//Joi로 입력값 검증 (로그인)
// const postAuthSchema = Joi.object({
//     email: Joi.string().email().required(), // email형식을 지원한다
//     password: Joi.string().required(),
// })

// 로그인 api (사용자 유효성 검사 필요)
router.post('/auth', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ where: { email, password } }) // find가 아니라 왜 FindOne????????

    if (!user) {
      // user가 없다면
      res.status(400).send({
        errorMessage: '이메일 또는 패스워가 틀렸습니다',
      })
      return
    }
    const token = jwt.sign({ userId: user.userId }, 'my-secret-key') //여기 한번 더 들어보자!!!!!!!!!!!!
    res.send({
      token,
    })
  } catch (error) {
    // postAuthSchema 형식에 맞지않으면 이런 에러가 나옴
    console.log(error)
    res.status(400).send({
      errorMessage: '요청한 데이터 형식이 올바르지 않습니다',
    })
  }
})

// /users/me로 들어오는 경우에 authMiddleware(사용자인증 미들웨어)가 붙는다
router.get('/users/me', authMiddleware, async (req, res) => {
  // 사용자정보 보관소
  const { user } = res.locals
  // console.log(user)
  res.send({
    // 객체안에 값이 다 있기 때문에 user, 만 써줘도 된다
    user: {
      email: user.email,
      nickname: user.nickname,
    },
  })
})

//장바구니 목록 가져오기...
router.get('/goods/cart', authMiddleware, async (req, res) => {
  const { userId } = res.locals.user

  const cart = await Cart.findAll({
    where: {
      userId,
    },
  })

  const goodsIds = cart.map((c) => c.goodsId)

  // 루프 줄이기 위해 Mapping 가능한 객체로 만든것
  const goodsKeyById = await Goods.findAll({
    where: {
      goodsId: goodsIds, // 배열만 넣으면 or조건으로 다 찾을 수 있다
    },
  }).then((goods) =>
    goods.reduce(
      (prev, g) => ({
        ...prev,
        [g.goodsId]: g,
      }),
      {}
    )
  )

  res.send({
    cart: cart.map((c) => ({
      quantity: c.quantity,
      goods: goodsKeyById[c.goodsId],
    })),
  })
})

// 장바구니에 상품담기
router.put('/goods/:goodsId/cart', authMiddleware, async (req, res) => {
  const { userId } = res.locals.user
  const { goodsId } = req.params
  const { quantity } = req.body

  const existsCart = Cart.findOne({
    //findOne함수는 시퀄라이즈에 있다.
    where: {
      userId,
      goodsId,
    },
  })

  if (existsCart) {
    existsCart.quantity = quantity
    await existsCart.save()
  } else {
    await Cart.create({
      userId,
      goodsId,
      quantity,
    })
  }
})

// 모든 상품 가져오기
router.get('/goods', authMiddleware, async (req, res) => {
  const { category } = req.query
  const goods = await Goods.findAll({
    order: [['goodsId', 'DESC']], // SQL 내림차순 'DESC'. 여기서 사용한 배열구문은 mysql에서 중요하다
    where: category ? { category } : undefined,
  })

  res.send({ goods })
})

//상품 하나 가져오기
router.get('/goods/:goodsId', authMiddleware, async (req, res) => {
  const { goodsId } = req.params
  const goods = await Goods.findByPk(goodsId)

  if (!goods) {
    res.status(404).send({})
  } else {
    res.send({ goods })
  }
})

// 장바구니 항목 삭제
router.delete('/goods/:goodsId/cart', authMiddleware, async (req, res) => {
  const { userId } = res.locals.user
  const { goodsId } = req.params // 상품ID를 받아옴

  const existsCart = await Cart.findOne({
    where: {
      userId,
      goodsId,
    },
  })

  if (existsCart) {
    await existsCart.destroy()
  }

  res.send({}) // 성공했을시 딱히 정해진 응답값이 없다
})

app.use('/api', express.urlencoded({ extended: false }), router)
app.use(express.static('assets'))

http.listen(8080, () => {
  // http로 소켓io랑 app이랑 합쳐진거 실행
  console.log('서버가 요청을 받을 준비가 됐어요')
})

// 회원가입과 로그인은 사용자인증을 할 수 없기때문에 authMiddleware를 쓰지않는다
