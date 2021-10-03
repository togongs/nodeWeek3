'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  User.init(
    {
      // mysql의 기본값 id를 userId로 바꾸는 작업
      // 자세한 속성들을 정의해주기 위해서 객체를 사용
      //INTEGER는 정수형태의 숫자
      userId: {
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      email: DataTypes.STRING,
      nickname: DataTypes.STRING,
      password: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'User',
    }
  )
  return User
}
