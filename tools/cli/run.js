#!/usr/bin/env node

require('colorful').colorful();
const gulp = require('gulp');
const program = require('commander');
program.on('--help', () => {
  console.log('  Usage:'.to.blue.color);
  console.log();
});
program.parse(process.argv);

function runTask(toRun) {
  const metaData = {
    task: toRun,
  };
  const taskInstance = gulp.task(toRun);
  if (taskInstance == undefined) {
    gulp.emit('task_not_found', metaData);
    return;
  }
  const start = process.hrtime();
  gulp.emit('task_start', metaData);
  try {
    taskInstance.apply(gulp);
    metaData.hrDuration = process.hrtime(start);
    gulp.emit('task_stop', metaData);
    gulp.emit('stop');
  } catch (err) {
    err.hrDuration = process.hrtime(start);
    err.task = metaData.task;
    gulp.emit('task_err', err);
  }
}
const task = program.args[0];

if (!task) {
  program.help();
} else {
  console.log('antd-tools run', task);

  require('../gulpfile');

  runTask(task);
}