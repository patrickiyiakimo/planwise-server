CREATE DATABASE planwise;

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    fullname VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    accept_terms BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMP,
    priority VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    instructor VARCHAR(255) NOT NULL,
    instructor_email VARCHAR(255),
    instructor_office VARCHAR(255),
    semester VARCHAR(50) NOT NULL,
    credit_hours INTEGER NOT NULL CHECK (credit_hours > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'planned' 
        CHECK (status IN ('planned', 'in-progress', 'completed')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    grade VARCHAR(5),
    grade_points DECIMAL(3,2),
    start_date DATE,
    end_date DATE,
    color VARCHAR(20) DEFAULT 'blue',
    icon VARCHAR(10) DEFAULT '📚',
    syllabus_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_schedules (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    day VARCHAR(20) NOT NULL,
    time VARCHAR(50) NOT NULL,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_materials (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_assignments (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMP NOT NULL,
    points INTEGER DEFAULT 100,
    status VARCHAR(50) DEFAULT 'pending'
        CHECK (status IN ('pending', 'submitted', 'graded')),
    priority VARCHAR(20) DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high')),
    submitted BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP,
    submission_note TEXT,
    submission_file_url TEXT,
    grade INTEGER,
    feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_announcements (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================

-- Core indexes for courses table
CREATE INDEX idx_courses_user_id ON courses(user_id);
CREATE INDEX idx_courses_user_status ON courses(user_id, status);
CREATE INDEX idx_courses_user_semester ON courses(user_id, semester);
CREATE INDEX idx_courses_user_credit_hours ON courses(user_id, credit_hours);
CREATE INDEX idx_courses_user_grade_points ON courses(user_id, grade_points);
CREATE INDEX idx_courses_created_at ON courses(created_at);
CREATE INDEX idx_courses_status ON courses(status);
CREATE INDEX idx_courses_semester ON courses(semester);
CREATE INDEX idx_courses_instructor ON courses(instructor);

CREATE INDEX idx_courses_user_status_semester ON courses(user_id, status, semester);
CREATE INDEX idx_courses_user_grade_status ON courses(user_id, grade_points, status);

CREATE INDEX idx_schedules_course_id ON course_schedules(course_id);
CREATE INDEX idx_schedules_day ON course_schedules(day);

CREATE INDEX idx_materials_course_id ON course_materials(course_id);
CREATE INDEX idx_materials_type ON course_materials(type);

CREATE INDEX idx_assignments_course_id ON course_assignments(course_id);
CREATE INDEX idx_assignments_due_date ON course_assignments(due_date);
CREATE INDEX idx_assignments_status ON course_assignments(status);
CREATE INDEX idx_assignments_priority ON course_assignments(priority);
CREATE INDEX idx_assignments_course_status ON course_assignments(course_id, status);
CREATE INDEX idx_assignments_course_due ON course_assignments(course_id, due_date);

CREATE INDEX idx_announcements_course_id ON course_announcements(course_id);
CREATE INDEX idx_announcements_created_at ON course_announcements(created_at);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON courses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at
    BEFORE UPDATE ON course_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();