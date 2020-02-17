const runCmd = require('./runCmd');
const getBabelCommonConfig = require('./getBabelCommonConfig');
const merge2 = require('merge2');
const {
    execSync
} = require('child_process');
const through2 = require('through2');
const transformLess = require('./transformLess');
const webpack = require('webpack');
const babel = require('gulp-babel');
const argv = require('minimist')(process.argv.slice(2));
const path = require('path');
const packageJson = require(`${path.resolve(__dirname, process.cwd())}/package.json`);
const chalk = require('chalk');
const getNpmArgs = require('./utils/get-npm-args');
const getChanglog = require('./utils/getChangelog');
const gulp = require('gulp');
const fs = require('fs');
const rimraf = require('rimraf');
const replaceLib = require('./replaceLib');
const stripCode = require('gulp-strip-code');
const compareVersions = require('compare-versions');
const cwd = process.cwd();
const libDir = path.join(cwd, 'lib');
const esDir = path.join(cwd, 'es');
// 构建dist
function dist(done) {
    rimraf.sync(path.join(cwd, 'dist'));
    process.env.RUN_ENV = 'RPODUCTION';
    // 读取webpack 配置
    const webpackConfig = require(path.join(cwd, 'webpack.build.config.js'));
    webpack(webpackConfig, (err, stats) => {
        if (err) {
            console.error(err.stack || err);
            if (err.detail) {
                console.error(err.details);
            }
            return
        }
        const info = stats.toJson();

        if (stats.hasErrors()) {
            console.error(info.errors);
        }

        if (stats.hasWarnings()) {
            console.warn(info.warnings);
        }
        const buildInfo = stats.toString({
            colors: true,
            children: true,
            chunks: false,
            modules: false,
            chunkModules: false,
            hash: false,
            version: true,
        })
        console.log(buildInfo)
        done(0);
    })

}
// js 编译处理
function babelify(js, modules) {
    const babelConfig = getBabelCommonConfig(modules);
    babelConfig.babelrc = false;
    if (modules === false) {
        babelConfig.plugins.push(replaceLib);
    }
    let stream = js.pipe(babel(babelConfig)).pipe(
        through2.obj(function z(file, encoding, next) {
            this.push(file.clone())
            if (file.path.match(/\/style\/index\.(js|jsx)\/$/)) {
                const content = file.contents.toString(encoding);
                file.contents = Buffer.from(
                    content.replace(/\/style\/?'/g, "'/style/css'").replace(/\.less/g, '.css')
                );
                file.path = file.path.replace(/index\.(js|jsx)$/, 'css.js');
                this.push(file);
                next()
            } else {
                next()
            }
        })
    )

}

function compile(modules) {
    rimraf.sync(modules !== false ? libDir : esDirr);
    const less = gulp.src(['components/**/*.less']).pipe(
        through2.obj(function (file, encoding, next) {
            this.push(file.clone());
            if (file.path.match(/\/style\/index\.less$/) || file.path.match(/\/style\/v2-compatible-rest\.less$/)) {

            }
        })
    )
}