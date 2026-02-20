const express = require('express')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const {format, parse} = require('date-fns')

const app = express()
app.use(express.json())

let db = null
const dbPath = 'todoApplication.db'

const initializeDbAndServer = async () => {
  try {
    db = await open({filename: dbPath, driver: sqlite3.Database})
    app.listen(3000, () =>
      console.log('Server is running at http://localhost:3000'),
    )
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

// Valid Values
const validStatus = ['TO DO', 'IN PROGRESS', 'DONE']
const validPriority = ['HIGH', 'MEDIUM', 'LOW']
const validCategory = ['WORK', 'HOME', 'LEARNING']

// Validators
const validateFields = todo => {
  if (todo.status && !validStatus.includes(todo.status))
    return 'Invalid Todo Status'
  if (todo.priority && !validPriority.includes(todo.priority))
    return 'Invalid Todo Priority'
  if (todo.category && !validCategory.includes(todo.category))
    return 'Invalid Todo Category'
  if (todo.dueDate) {
    try {
      const parsedDate = new Date(todo.dueDate)
      if (isNaN(parsedDate)) throw new Error()
      todo.dueDate = format(parsedDate, 'yyyy-MM-dd')
    } catch {
      return 'Invalid Due Date'
    }
  }
  return null
}

// GET todos with filters
app.get('/todos/', async (request, response) => {
  const {status, priority, category, search_q = ''} = request.query

  const error = validateFields({status, priority, category})
  if (error) return response.status(400).send(error)

  const query = `
    SELECT * FROM todo
    WHERE todo LIKE '%${search_q}%'
    ${status ? `AND status = '${status}'` : ''}
    ${priority ? `AND priority = '${priority}'` : ''}
    ${category ? `AND category = '${category}'` : ''}
  `

  const convertToCamelCase = todo => ({
    id: todo.id,
    todo: todo.todo,
    priority: todo.priority,
    status: todo.status,
    category: todo.category,
    dueDate: todo.due_date,
  })

  const todos = await db.all(query)
  response.send(todos.map(convertToCamelCase))
})

// GET specific todo by ID
app.get('/todos/:id/', async (request, response) => {
  const {id} = request.params
  const todo = await db.get(`SELECT * FROM todo WHERE id = ${id}`)

  const convertToCamelCase = todo => ({
    id: todo.id,
    todo: todo.todo,
    priority: todo.priority,
    status: todo.status,
    category: todo.category,
    dueDate: todo.due_date,
  })
  response.send(convertToCamelCase(todo))
  console.log(todo)
})

// GET todos by due date
app.get('/agenda/', async (request, response) => {
  let {date} = request.query
  try {
    const formattedDate = format(new Date(date), 'yyyy-MM-dd')
    const todos = await db.all(`SELECT * FROM todo WHERE due_date = ?`, [
      formattedDate,
    ])
    response.send(todos)
  } catch {
    response.status(400).send('Invalid Due Date')
  }
})

// POST a new todo
app.post('/todos/', async (request, response) => {
  const {id, todo, category, priority, status, dueDate} = request.body
  const validationError = validateFields({status, priority, category, dueDate})

  if (validationError) return response.status(400).send(validationError)

  const formattedDate = format(new Date(dueDate), 'yyyy-MM-dd')

  const insertQuery = `
    INSERT INTO todo (id, todo, category, priority, status, due_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `

  await db.run(insertQuery, [
    id,
    todo,
    category,
    priority,
    status,
    formattedDate,
  ])
  response.send('Todo Successfully Added')
})

// PUT (update) a todo
app.put('/todos/:id/', async (request, response) => {
  const {id} = request.params
  const requestBody = request.body

  const field = Object.keys(requestBody)[0]

  const validationError = validateFields(requestBody)
  if (validationError) return response.status(400).send(validationError)

  const todoPrev = await db.get(`SELECT * FROM todo WHERE id = ?`, [id])

  const {
    todo = todoPrev.todo,
    status = todoPrev.status,
    priority = todoPrev.priority,
    category = todoPrev.category,
    dueDate = todoPrev.due_date,
  } = {...todoPrev, ...requestBody}

  const formattedDate = format(new Date(dueDate), 'yyyy-MM-dd')

  const updateQuery = `
    UPDATE todo
    SET todo = ?, status = ?, priority = ?, category = ?, due_date = ?
    WHERE id = ?
  `

  await db.run(updateQuery, [
    todo,
    status,
    priority,
    category,
    formattedDate,
    id,
  ])
  response.send(`${field[0].toUpperCase() + field.slice(1)} Updated`)
})

// DELETE a todo
app.delete('/todos/:id/', async (request, response) => {
  const {id} = request.params
  await db.run(`DELETE FROM todo WHERE id = ?`, [id])
  response.send('Todo Deleted')
})

module.exports = app
