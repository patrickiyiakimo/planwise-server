const pool = require("../config/db");

// helper functions

const getUserIdFromRequest = (req, res) => {
    return req.user?.id;
}

const formatCourseResponse = (course) => ({
    id: course.id,
    code: course.code,
    name: course.name,
    description: course.description,
    instructor: course.instructor,
    instructorEmail: course.instructor_email,
    instructorOffice: course.instructor_office,
    semester: course.semester,
    creditHours: course.credit_hours,
    status: course.status,
    progress: course.progress,
    grade: course.grade,
    gradePoints: course.grade_points,
    startDate: course.start_date,
    endDate: course.end_date,
    color: course.color,
    icon: course.icon,
    syllabus: course.syllabus_url,
    createdAt: course.created_at,
    updatedAt: course.updated_at
});


//get all courses with filtering, sorting and pagination

const getCourses = async (req, res) => {
    const userId = getUserIdFromRequest(req);
    if(!userId){
        return res.status(401).json({message: "Unauthorised"});
    }

   try {
        const {
            status,
            semester,
            instructor,
            min_credits,
            max_credits,
            search,
            sort_by = 'created_at',
            sort_order = 'desc',
            page = 1,
            limit = 10
        } = req.query;

        const offset = (page - 1) * limit;

        // Build dynamic WHERE clause
        let query = 'SELECT * FROM courses WHERE user_id = $1';
        const params = [userId];
        let paramIndex = 2;

        // Apply filters (using indexes)
        if (status && status !== 'all') {
            query += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (semester && semester !== 'all') {
            query += ` AND semester = $${paramIndex}`;
            params.push(semester);
            paramIndex++;
        }

        if (instructor && instructor !== 'all') {
            query += ` AND instructor = $${paramIndex}`;
            params.push(instructor);
            paramIndex++;
        }

        if (min_credits) {
            query += ` AND credit_hours >= $${paramIndex}`;
            params.push(min_credits);
            paramIndex++;
        }

        if (max_credits) {
            query += ` AND credit_hours <= $${paramIndex}`;
            params.push(max_credits);
            paramIndex++;
        }

        if (search) {
            query += ` AND (code ILIKE $${paramIndex} OR name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR instructor ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Get total count for pagination
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
        const countResult = await pool.query(countQuery, params.slice(0, paramIndex - 1));
        const total = parseInt(countResult.rows[0].count);

        // Apply sorting (using indexes)
        const validSortFields = ['created_at', 'code', 'name', 'credit_hours', 'status', 'progress', 'grade_points'];
        const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
        const sortOrder = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        
        query += ` ORDER BY ${sortField} ${sortOrder}`;

        // Apply pagination
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        // Execute main query
        const result = await pool.query(query, params);

        // Fetch additional data for each course
        const coursesWithDetails = await Promise.all(
            result.rows.map(async (course) => {
                const courseId = course.id;

                // Get schedules (using index: idx_schedules_course_id)
                const schedules = await pool.query(
                    'SELECT day, time, location FROM course_schedules WHERE course_id = $1 ORDER BY day',
                    [courseId]
                );

                // Get materials (using index: idx_materials_course_id)
                const materials = await pool.query(
                    'SELECT id, title, type, url FROM course_materials WHERE course_id = $1 ORDER BY created_at DESC',
                    [courseId]
                );

                // Get assignments (using index: idx_assignments_course_id)
                const assignments = await pool.query(
                    `SELECT id, title, description, due_date, points, status, priority, 
                            submitted, submitted_at, submission_note, grade, feedback
                     FROM course_assignments 
                     WHERE course_id = $1 
                     ORDER BY due_date ASC`,
                    [courseId]
                );

                // Get announcements (using index: idx_announcements_course_id)
                const announcements = await pool.query(
                    'SELECT id, title, content, created_at FROM course_announcements WHERE course_id = $1 ORDER BY created_at DESC',
                    [courseId]
                );

                return {
                    ...formatCourseResponse(course),
                    schedule: schedules.rows,
                    materials: materials.rows,
                    assignments: assignments.rows,
                    announcements: announcements.rows
                };
            })
        );

        res.json({
            success: true,
            data: coursesWithDetails,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (err) {
        console.error('Get courses error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ============================================
// GET SINGLE COURSE BY ID
// ============================================

const getCourseById = async (req, res) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const courseId = req.params.id;

    // Validate ID
    if (isNaN(courseId)) {
        return res.status(400).json({ message: "Invalid course ID" });
    }

    try {
        // Get course (using index: idx_courses_user_id + primary key)
        const courseResult = await pool.query(
            'SELECT * FROM courses WHERE id = $1 AND user_id = $2',
            [courseId, userId]
        );

        if (courseResult.rows.length === 0) {
            return res.status(404).json({ message: "Course not found" });
        }

        const course = courseResult.rows[0];

        // Get schedules
        const schedules = await pool.query(
            'SELECT day, time, location FROM course_schedules WHERE course_id = $1 ORDER BY day',
            [courseId]
        );

        // Get materials
        const materials = await pool.query(
            'SELECT id, title, type, url FROM course_materials WHERE course_id = $1 ORDER BY created_at DESC',
            [courseId]
        );

        // Get assignments
        const assignments = await pool.query(
            `SELECT id, title, description, due_date, points, status, priority, 
                    submitted, submitted_at, submission_note, grade, feedback
             FROM course_assignments 
             WHERE course_id = $1 
             ORDER BY due_date ASC`,
            [courseId]
        );

        // Get announcements
        const announcements = await pool.query(
            'SELECT id, title, content, created_at FROM course_announcements WHERE course_id = $1 ORDER BY created_at DESC',
            [courseId]
        );

        res.json({
            success: true,
            data: {
                ...formatCourseResponse(course),
                schedule: schedules.rows,
                materials: materials.rows,
                assignments: assignments.rows,
                announcements: announcements.rows
            }
        });

    } catch (err) {
        console.error('Get course by ID error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ============================================
// CREATE NEW COURSE
// ============================================

const createCourse = async (req, res) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const {
        code,
        name,
        description,
        instructor,
        instructorEmail,
        instructorOffice,
        semester,
        creditHours,
        status = 'planned',
        startDate,
        endDate,
        color = 'blue',
        icon = '📚',
        syllabus,
        schedule = [],
        materials = [],
        assignments = [],
        announcements = []
    } = req.body;

    // Validate required fields
    if (!code || !name || !instructor || !semester || !creditHours) {
        return res.status(400).json({ 
            message: "Missing required fields: code, name, instructor, semester, creditHours" 
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Insert course
        const courseResult = await client.query(
            `INSERT INTO courses (
                user_id, code, name, description, instructor, instructor_email,
                instructor_office, semester, credit_hours, status, start_date,
                end_date, color, icon, syllabus_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *`,
            [
                userId, code, name, description, instructor, instructorEmail,
                instructorOffice, semester, creditHours, status, startDate,
                endDate, color, icon, syllabus
            ]
        );

        const courseId = courseResult.rows[0].id;

        // Insert schedule
        if (schedule.length > 0) {
            for (const sch of schedule) {
                await client.query(
                    'INSERT INTO course_schedules (course_id, day, time, location) VALUES ($1, $2, $3, $4)',
                    [courseId, sch.day, sch.time, sch.location]
                );
            }
        }

        // Insert materials
        if (materials.length > 0) {
            for (const mat of materials) {
                await client.query(
                    'INSERT INTO course_materials (course_id, title, type, url) VALUES ($1, $2, $3, $4)',
                    [courseId, mat.title, mat.type, mat.url]
                );
            }
        }

        // Insert assignments
        if (assignments.length > 0) {
            for (const ass of assignments) {
                await client.query(
                    `INSERT INTO course_assignments (
                        course_id, title, description, due_date, points, priority
                    ) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [courseId, ass.title, ass.description, ass.dueDate, ass.points, ass.priority]
                );
            }
        }

        // Insert announcements
        if (announcements.length > 0) {
            for (const ann of announcements) {
                await client.query(
                    'INSERT INTO course_announcements (course_id, title, content) VALUES ($1, $2, $3)',
                    [courseId, ann.title, ann.content]
                );
            }
        }

        await client.query('COMMIT');

        // Fetch complete course with all relations
        const completeCourse = await getCompleteCourse(client, courseId);

        res.status(201).json({
            success: true,
            message: 'Course created successfully',
            data: completeCourse
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create course error:', err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

// ============================================
// UPDATE COURSE
// ============================================

const updateCourse = async (req, res) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const courseId = req.params.id;

    if (isNaN(courseId)) {
        return res.status(400).json({ message: "Invalid course ID" });
    }

    const updates = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Check if course exists and belongs to user
        const courseCheck = await client.query(
            'SELECT id FROM courses WHERE id = $1 AND user_id = $2',
            [courseId, userId]
        );

        if (courseCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Course not found" });
        }

        // Build dynamic update query for course
        const allowedFields = [
            'code', 'name', 'description', 'instructor', 'instructor_email',
            'instructor_office', 'semester', 'credit_hours', 'status',
            'progress', 'grade', 'grade_points', 'start_date', 'end_date',
            'color', 'icon', 'syllabus_url'
        ];

        const updateFields = [];
        const updateValues = [];
        let valueIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            const dbField = mapToDbField(key);
            if (allowedFields.includes(dbField) && value !== undefined) {
                updateFields.push(`${dbField} = $${valueIndex}`);
                updateValues.push(value);
                valueIndex++;
            }
        }

        if (updateFields.length > 0) {
            updateValues.push(courseId, userId);
            const updateQuery = `UPDATE courses SET ${updateFields.join(', ')} WHERE id = $${valueIndex} AND user_id = $${valueIndex + 1} RETURNING *`;
            await client.query(updateQuery, updateValues);
        }

        // Handle schedule updates if provided
        if (updates.schedule) {
            await client.query('DELETE FROM course_schedules WHERE course_id = $1', [courseId]);
            for (const sch of updates.schedule) {
                await client.query(
                    'INSERT INTO course_schedules (course_id, day, time, location) VALUES ($1, $2, $3, $4)',
                    [courseId, sch.day, sch.time, sch.location]
                );
            }
        }

        // Handle materials updates if provided
        if (updates.materials) {
            await client.query('DELETE FROM course_materials WHERE course_id = $1', [courseId]);
            for (const mat of updates.materials) {
                await client.query(
                    'INSERT INTO course_materials (course_id, title, type, url) VALUES ($1, $2, $3, $4)',
                    [courseId, mat.title, mat.type, mat.url]
                );
            }
        }

        await client.query('COMMIT');

        // Fetch updated course
        const completeCourse = await getCompleteCourse(client, courseId);

        res.json({
            success: true,
            message: 'Course updated successfully',
            data: completeCourse
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update course error:', err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

// ============================================
// DELETE COURSE
// ============================================

const deleteCourse = async (req, res) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const courseId = req.params.id;

    if (isNaN(courseId)) {
        return res.status(400).json({ message: "Invalid course ID" });
    }

    try {
        const result = await pool.query(
            'DELETE FROM courses WHERE id = $1 AND user_id = $2 RETURNING id',
            [courseId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Course not found" });
        }

        res.json({
            success: true,
            message: 'Course deleted successfully'
        });

    } catch (err) {
        console.error('Delete course error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ============================================
// ASSIGNMENT OPERATIONS
// ============================================

const submitAssignment = async (req, res) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const { courseId, assignmentId } = req.params;
    const { submissionNote, fileUrl } = req.body;

    if (isNaN(courseId) || isNaN(assignmentId)) {
        return res.status(400).json({ message: "Invalid IDs" });
    }

    try {
        // Verify course ownership
        const courseCheck = await pool.query(
            'SELECT id FROM courses WHERE id = $1 AND user_id = $2',
            [courseId, userId]
        );

        if (courseCheck.rows.length === 0) {
            return res.status(404).json({ message: "Course not found" });
        }

        // Update assignment
        const result = await pool.query(
            `UPDATE course_assignments 
             SET status = 'submitted', submitted = TRUE, 
                 submitted_at = CURRENT_TIMESTAMP, 
                 submission_note = $1, 
                 submission_file_url = $2
             WHERE id = $3 AND course_id = $4
             RETURNING *`,
            [submissionNote, fileUrl, assignmentId, courseId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Assignment not found" });
        }

        res.json({
            success: true,
            message: 'Assignment submitted successfully',
            data: result.rows[0]
        });

    } catch (err) {
        console.error('Submit assignment error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ============================================
// COURSE STATISTICS
// ============================================

const getCourseStats = async (req, res) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        // Get course statistics using aggregations (using indexes)
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total_courses,
                COUNT(CASE WHEN status = 'in-progress' THEN 1 END) as in_progress,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'planned' THEN 1 END) as planned,
                SUM(credit_hours) as total_credits,
                AVG(CASE WHEN grade_points IS NOT NULL THEN grade_points END) as avg_gpa,
                COUNT(CASE WHEN grade IS NOT NULL THEN 1 END) as graded_courses
            FROM courses 
            WHERE user_id = $1
        `, [userId]);

        // Get upcoming assignments (using indexes)
        const upcomingAssignments = await pool.query(`
            SELECT ca.*, c.code as course_code, c.name as course_name
            FROM course_assignments ca
            JOIN courses c ON ca.course_id = c.id
            WHERE c.user_id = $1 
              AND ca.due_date > NOW() 
              AND ca.status = 'pending'
            ORDER BY ca.due_date ASC
            LIMIT 10
        `, [userId]);

        // Get grade distribution
        const gradeDist = await pool.query(`
            SELECT 
                CASE 
                    WHEN grade LIKE 'A%' THEN 'A'
                    WHEN grade LIKE 'B%' THEN 'B'
                    WHEN grade LIKE 'C%' THEN 'C'
                    WHEN grade LIKE 'D%' THEN 'D'
                    WHEN grade LIKE 'F%' THEN 'F'
                END as grade_category,
                COUNT(*) as count
            FROM courses 
            WHERE user_id = $1 AND grade IS NOT NULL
            GROUP BY grade_category
        `, [userId]);

        const row = stats.rows[0];
        
        res.json({
            success: true,
            data: {
                total: parseInt(row.total_courses) || 0,
                inProgress: parseInt(row.in_progress) || 0,
                completed: parseInt(row.completed) || 0,
                planned: parseInt(row.planned) || 0,
                totalCredits: parseInt(row.total_credits) || 0,
                currentGPA: row.avg_gpa ? parseFloat(row.avg_gpa).toFixed(2) : '0.00',
                gradedCourses: parseInt(row.graded_courses) || 0,
                upcomingAssignments: upcomingAssignments.rows,
                gradeDistribution: gradeDist.rows
            }
        });

    } catch (err) {
        console.error('Get course stats error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ============================================
// HELPER FUNCTION
// ============================================

const mapToDbField = (field) => {
    const mapping = {
        'code': 'code',
        'name': 'name',
        'description': 'description',
        'instructor': 'instructor',
        'instructorEmail': 'instructor_email',
        'instructorOffice': 'instructor_office',
        'semester': 'semester',
        'creditHours': 'credit_hours',
        'status': 'status',
        'progress': 'progress',
        'grade': 'grade',
        'gradePoints': 'grade_points',
        'startDate': 'start_date',
        'endDate': 'end_date',
        'color': 'color',
        'icon': 'icon',
        'syllabus': 'syllabus_url'
    };
    return mapping[field] || field;
};

const getCompleteCourse = async (client, courseId) => {
    const course = await client.query('SELECT * FROM courses WHERE id = $1', [courseId]);
    
    const schedules = await client.query(
        'SELECT day, time, location FROM course_schedules WHERE course_id = $1 ORDER BY day',
        [courseId]
    );

    const materials = await client.query(
        'SELECT id, title, type, url FROM course_materials WHERE course_id = $1 ORDER BY created_at DESC',
        [courseId]
    );

    const assignments = await client.query(
        `SELECT id, title, description, due_date, points, status, priority, 
                submitted, submitted_at, submission_note, grade, feedback
         FROM course_assignments 
         WHERE course_id = $1 
         ORDER BY due_date ASC`,
        [courseId]
    );

    const announcements = await client.query(
        'SELECT id, title, content, created_at FROM course_announcements WHERE course_id = $1 ORDER BY created_at DESC',
        [courseId]
    );

    return {
        ...formatCourseResponse(course.rows[0]),
        schedule: schedules.rows,
        materials: materials.rows,
        assignments: assignments.rows,
        announcements: announcements.rows
    };
};

module.exports = {
    getCourses,
    getCourseById,
    createCourse,
    updateCourse,
    deleteCourse,
    submitAssignment,
    getCourseStats
};
