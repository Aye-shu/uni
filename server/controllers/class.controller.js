// server/controllers/class.controller.js
import ClassSchedule from "../models/ClassSchedule.js";

// GET /api/classes — list current student's classes
export const getMyClasses = async (req, res) => {
  try {
    const classes = await ClassSchedule.find({ student: req.user.id }).sort({
      day: 1,
      startTime: 1,
    });
    res.json({ success: true, data: classes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/classes/:id
export const getClassById = async (req, res) => {
  try {
    const cls = await ClassSchedule.findById(req.params.id);
    if (!cls) return res.status(404).json({ success: false, message: "Class not found" });
    if (cls.student !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Forbidden" });
    res.json({ success: true, data: cls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/classes
export const createClass = async (req, res) => {
  try {
    const cls = await ClassSchedule.create({ ...req.body, student: req.user.id });
    res.status(201).json({ success: true, data: cls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/classes/:id
export const updateClass = async (req, res) => {
  try {
    const cls = await ClassSchedule.findOneAndUpdate(
      { _id: req.params.id, student: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!cls) return res.status(404).json({ success: false, message: "Class not found" });
    res.json({ success: true, data: cls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/classes/:id
export const deleteClass = async (req, res) => {
  try {
    const cls = await ClassSchedule.findOneAndDelete({
      _id: req.params.id,
      student: req.user.id,
    });
    if (!cls) return res.status(404).json({ success: false, message: "Class not found" });
    res.json({ success: true, message: "Class deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/classes/day/:day — get classes for a specific day
export const getClassesByDay = async (req, res) => {
  try {
    const classes = await ClassSchedule.find({
      student: req.user.id,
      day: req.params.day,
    }).sort({ startTime: 1 });
    res.json({ success: true, data: classes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};