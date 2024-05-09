const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.json());
app.use(cors());

const pool = new Pool({
  user: 'postgres',
  host: 'localhost', 
  database: 'postgres', 
  password: 'root', 
  port: 5432, 
});

app.get('/test', async (req, res) => {
    try {
      const client = await pool.connect();
      res.send('Connected to PostgreSQL database successfully!');
      client.release();
    } catch (error) {
      console.error('Error connecting to PostgreSQL database:', error);
      res.status(500).send('Error connecting to PostgreSQL database');
    }
  });

  app.get('/students', async (req, res) => {
    const page = parseInt(req.query.page) || 1; 
    const limit = parseInt(req.query.limit) || 5;
    const searchQuery = req.query.search || '';
    
    try {
        let queryText = `SELECT 
            (SELECT COUNT(*) FROM student_schema.students WHERE student_name ILIKE $1) AS count,
            * FROM student_schema.students`;
        let queryParams = [`%${searchQuery}%`];

        if (searchQuery) {
            queryText += ' WHERE student_name ILIKE $1';
        }

        const result = await pool.query(queryText, queryParams);
        const totalCount = parseInt(result.rows[0].count);
        const totalPages = Math.ceil(totalCount / limit);
        const offset = (page - 1) * limit;

        queryParams.push(limit, offset);

        queryText += ' ORDER BY student_id LIMIT $' + (queryParams.length - 1) + ' OFFSET $' + queryParams.length;
        
        const { rows } = await pool.query(queryText, queryParams);

        res.json({
            page,
            totalPages,
            totalCount,
            students: rows
        });
    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/students/:id', async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        const studentResult = await pool.query('SELECT * FROM student_schema.students WHERE student_id = $1', [studentId]);
        const marksResult = await pool.query('SELECT * FROM student_schema.marks WHERE student_id = $1', [studentId]);

        if (studentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const student = studentResult.rows[0];
        const marks = marksResult.rows;

        res.json({ student, marks });
    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/students', async (req, res) => {
    const { student_name, student_email, student_age, student_parent_id, date_of_birth } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO student_schema.students (student_name, student_email,student_age,student_parent_id, date_of_birth) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [student_name, student_email, student_age, student_parent_id, date_of_birth]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/courses', async (req, res) => {
    const { course_name, course_code } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO student_schema.courses (course_name, course_code) VALUES ($1, $2) RETURNING *',
            [course_name, course_code]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/marks', async (req, res) => {
    const { student_id, course_id, mark, date_recorded } = req.body;

    try {
        // Check if student_id exists in the students table
        const studentExists = await pool.query(
            'SELECT student_id FROM student_schema.students WHERE student_id = $1',
            [student_id]
        );

        if (studentExists.rows.length === 0) {
            return res.status(404).json({ error: 'Student with provided student_id does not exist' });
        }

        const result = await pool.query(
            'INSERT INTO student_schema.marks (student_id, course_id, mark, date_recorded) VALUES ($1, $2, $3, $4) RETURNING *',
            [student_id, course_id, mark, date_recorded]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});



app.put('/students/:id', async (req, res) => {
    const studentId = parseInt(req.params.id);
    const { student_name, student_email, student_age, student_parent_id, date_of_birth } = req.body;

    try {
        const result = await pool.query(
            'UPDATE student_schema.students SET student_name = $1, student_email = $2, student_age = $3, student_parent_id =$4, date_of_birth = $5 WHERE student_id = $6 RETURNING *',
            [student_name, student_email, student_age, student_parent_id, date_of_birth, studentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/students/:id', async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        const marksResult = await pool.query('SELECT * FROM student_schema.marks WHERE student_id = $1', [studentId]);
        if (marksResult.rows.length > 0) {
            await pool.query('DELETE FROM student_schema.marks WHERE student_id = $1', [studentId]);
        }

        const result = await pool.query('DELETE FROM student_schema.students WHERE student_id = $1 RETURNING *', [studentId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        res.json({ message: 'Student deleted successfully' });
    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});