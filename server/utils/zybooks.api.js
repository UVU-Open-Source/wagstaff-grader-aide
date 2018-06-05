// sample request
/**
 * https://zyserver.zybooks.com/v1/zybook/UVUCS2550WagstaffSummer2018/activities/316123 <- user id
 *  ?auth_token=eyJhbGciOiJIUzI1NiIsImV4cCI6MTUyNjY4MDE3OSwiaWF0IjoxNTI2NTA3Mzc5fQ.eyJ1c2VyX2lkIjozMTczMDZ9.wtfo9bSg0kqxrGpOsD1JBRs9pVJUrFOCYyxtZj9htzs
 */
const axios = require('axios')

const { pluckData } = require('./core.api')

const base = axios.default.create({
  baseURL: 'https://zyserver.zybooks.com/v1'
})

module.exports = {
  addZybooksGradesToStudentWithToken(authToken, student) {
    return function(student) {
      return base
        .get(`/zybook/UVUCS2550WagstaffSummer2018/activities/${student.zybooksId}?auth_token=${authToken}`)
        .then(res => {
          return res
        })
        .then(res => {
          if(res.data.error) throw new Error(res.data.error.message)

          return res.data.data
        }) // first data from axios, second from zybooks request
        .then(rawZybooksData => formatScores(student, rawZybooksData))
    }
  },

  signin(email, password) {
    return base
    .post('/signin', { email, password })
    .then(pluckData)
  },

  renew(refresh_token) {
    return base
      .get(`/refresh?refresh_token=${refresh_token}`)
      .then(pluckData)
  }
}

// ==================================================
// helpers
// ==================================================
const convertToCanvasTotal = x => Math.round(x) / 10

function formatScores(student, rawZybooksData) {
  student.zybooksGrades = []

  for(const chapter of rawZybooksData) {
    let totalActivities = 0
    let completedActivities = 0

    for(const section of chapter) {
      for(const activity in section) {
        for(const question of section[activity]) {
          totalActivities++
          if(question) completedActivities++
        }
      }
    }

    const rawTotal = completedActivities/totalActivities * 100
    student.zybooksGrades.push(convertToCanvasTotal(rawTotal))
  }

  return student
}