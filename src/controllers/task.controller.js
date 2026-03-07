const pool = require("../config/db");

// Get all tasks for a user with filtering and pagination and sorting
const getTasks = async (req, res) => {
    const userId = req.user.id;

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const { status, priority, due_date, page = 1, limit = 10, sort_by = "created_at", order = "desc" } = req.query;

    const offset = (page - 1) * limit;
    let query = "SELECT * FROM tasks WHERE user_id = $1";
    const params = [userId];
    let paramIndex = 2;

    // Apply filters (using indexes: idx_tasks_user_status, idx_tasks_user_priority, idx_tasks_user_course)
    if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }
    if (priority) {
        query += ` AND priority = $${paramIndex}`;
        params.push(priority);
        paramIndex++;
    }
    if (due_date) {
        query += ` AND due_date <= $${paramIndex}`;
        params.push(due_date);
        paramIndex++;
    }

    // Apply sorting
    const validSortFields = ["created_at", "due_date", "priority"];
    if (!validSortFields.includes(sort_by)) {
        return res.status(400).json({ message: "Invalid sort field" });
    }
    query += ` ORDER BY ${sort_by} ${order === "asc" ? "ASC" : "DESC"}`;

    // Apply pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    try {
        const tasks = await pool.query(query, params);
        res.json(tasks.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};


//get stack statistics for a user
const getStats = async (req, res) => {
    const userId = req.user.id;
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const totalTasks = await pool.query("SELECT COUNT(*) FROM tasks WHERE user_id = $1", [userId]);
        const completedTasks = await pool.query("SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND status = 'completed'", [userId]);
        const pendingTasks = await pool.query("SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND status = 'pending'", [userId]);
        const overdueTasks = await pool.query("SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND due_date < NOW() AND status != 'completed'", [userId]);
        res.json({
            totalTasks: totalTasks.rows[0].count,
            completedTasks: completedTasks.rows[0].count,
            pendingTasks: pendingTasks.rows[0].count,
            overdueTasks: overdueTasks.rows[0].count
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

// Delete a task
const deleteTask = async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const task = await pool.query("SELECT * FROM tasks WHERE id = $1 AND user_id = $2", [taskId, userId]);
        if (task.rows.length === 0) {
            return res.status(404).json({ message: "Task not found" });
        }
        await pool.query("DELETE FROM tasks WHERE id = $1", [taskId]);
        res.json({ message: "Task deleted successfully" });
    }   
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

// Get a single task by ID
const getTaskById = async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    // Validate that taskId is a number
    if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID format" });
    }
 
    try {
        const task = await pool.query(
            "SELECT * FROM tasks WHERE id = $1 AND user_id = $2", 
            [taskId, userId]
        );
        
        if (task.rows.length === 0) {
            return res.status(404).json({ message: "Task not found" });
        }
        
        res.json(task.rows[0]);
    } catch (err) {
        console.error("Get task by ID error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Create a new task
const createTask = async (req, res) => {
    const userId = req.user.id;
    const { title, description, due_date, priority } = req.body;
    
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (!title) {
        return res.status(400).json({ message: "Title is required" });
    }

    try {
        const task = await pool.query(
            "INSERT INTO tasks (user_id, title, description, due_date, priority) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [userId, title, description, due_date, priority]
        );
        res.status(201).json(task.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

// Update a task
const updateTask = async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;
    const { title, description, due_date, priority, status } = req.body;
    
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const task = await pool.query("SELECT * FROM tasks WHERE id = $1 AND user_id = $2", [taskId, userId]);
        if (task.rows.length === 0) {
            return res.status(404).json({ message: "Task not found" });
        }
        
        const updatedTask = await pool.query(
            "UPDATE tasks SET title = $1, description = $2, due_date = $3, priority = $4, status = $5 WHERE id = $6 RETURNING *",
            [
                title || task.rows[0].title, 
                description || task.rows[0].description, 
                due_date || task.rows[0].due_date, 
                priority || task.rows[0].priority, 
                status || task.rows[0].status, 
                taskId
            ]
        );
        res.json(updatedTask.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getTasks,
    getStats,
    getTaskById,
    createTask,
    updateTask,
    deleteTask
};