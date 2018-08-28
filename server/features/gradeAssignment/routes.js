const router = require('express').Router()
const R = require('ramda')
const removeDiacritics = require('diacritics').remove;

const queries = require('./queries')

const canvasApi = require('../../utils/canvas.api')
const zybooksApi = require('../../utils/zybooks.api')

// only returns assignments for which we can grade via this app so far
router.get('/courses/:courseId/assignments', (req, res) => {
  const cToken = req.get('cToken')

  const { courseId } = req.params

  canvasApi.getCourseAssignments(cToken, courseId)
    .then(R.map(R.pickAll([ 'id', 'due_at', 'name' ])))
    // currently only auto grading zybooks chapter assignments. everything below will be the parts will that need to change the most
    .then(R.filter(assignment => assignment.name.startsWith('ch')))
    .then(res.json.bind(res))
    .catch(e => {
      res.status(500).end()
    })
})

router.put('/courses/:courseId/grade/zybooks/chapter/:cAssignmentId', (req, res) => {
  const cToken = req.get('cToken')
  const zyToken = req.get('zyToken')
  console.log('zyToken: ', zyToken);
  const { courseId, cAssignmentId } = req.params
  const { chapterNum } = req.body

  queries.findCourseByCanvasId(courseId)
    .then(({ zyLink }) => Promise.all([
      canvasApi.getStudentsInCourse(cToken, courseId),
      zybooksApi.getStudentsForCourse(zyToken, zyLink)
    ]))
    .then(mapCanvasToZybooksStudents)
    .then(addZybooksChapterGradesToStudentsWithZyToken(zyToken))
    .then(students => canvasApi.submitZybooksGradesToCanvas(cToken, cAssignmentId, chapterNum, students))
    .then(() => res.json({ success: true }))
    .catch(e => {
      res.status(500).end()
    })
})

module.exports = router

// ====================================================================================================
// helper functions
// ====================================================================================================
// englishifies and lower cases names to make comarison easier and more reliable
function cleanString(str) {
  return removeDiacritics(str).toLowerCase()
}

function mapCanvasToZybooksStudents([ cStudents, zyStudents ]) {
  return cStudents.map(cStudent => {
    const cleanCStudent = cleanString(cStudent.name)

    const zyStudent = zyStudents.find(zyStudent => {
      const cleanZyFirst = cleanString(zyStudent.first_name)
      const cleanZyLast = cleanString(zyStudent.last_name)

      return RegExp(`^${cleanZyFirst}.*${cleanZyLast}.*`).test(cleanCStudent)
    })

    return {
      name: cleanCStudent,
      canvasId: cStudent.id,
      zybooksId: zyStudent ? String(zyStudent.user_id) : ''
    }
  })
}

// returns students that have a zybooks id and their grades formatted chapter readings
function addZybooksChapterGradesToStudentsWithZyToken(zyToken) {
  return function(students) {
    const addZybooksGradesToStudent = zybooksApi.addZybooksGradesToStudentWithToken(zyToken)

    return Promise.all(
      students
        .filter(student => student.zybooksId) // don't grade students who aren't in zybooks yet
        .map(addZybooksGradesToStudent)
    )
  }
}
