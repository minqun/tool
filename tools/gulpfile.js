const runCmd = require('./runCmd');
const getBabelCommonConfig = require('./getBabelCommonConfig');
const merge2 = require('merge2');
const {
  execSync,
} = require('child_process');
const through2 = require('through2');
const transformLess = require('./transformLess');
const webpack = require('webpack');
const babel = require('gulp-babel');
const argv = require('minimist')(process.argv.slice(2));
const path = require('path');
const packageJson = require(`${process.cwd()}/package.json`);
const chalk = require('chalk');
const getNpmArgs = require('./utils/get-npm-args');
const getChangelog = require('./utils/getChangelog');
const gulp = require('gulp');
const GitHub = require('@octokit/rest');
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
      return;
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
    });
    console.log(buildInfo);
    done(0);
  });
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
      this.push(file.clone());
      if (file.path.match(/\/style\/index\.(js|jsx)\/$/)) {
        const content = file.contents.toString(encoding);
        file.contents = Buffer.from(
          content.replace(/\/style\/?'/g, "'/style/css'").replace(/\.less/g, '.css'),
        );
        file.path = file.path.replace(/index\.(js|jsx)$/, 'css.js');
        this.push(file);
        next();
      } else {
        next();
      }
    }),
  );
  if (modules === false) {
    stream = stream.pipe(
      stripCode({
        start_comment: '@remove-on-es-build-begin',
        end_comment: '@remove-on-es-build-end',
      }),
    );
  }
  return stream.pipe(gulp.dest(modules === false ? esDir : libDir));
}

function compile(modules) {
  rimraf.sync(modules !== false ? libDir : esDir);
  const less = gulp
    .src(['components/**/*.less'])
    .pipe(
      through2.obj(function (file, encoding, next) {
        this.push(file.clone());
        if (
          file.path.match(/\/style\/index\.less$/) ||
          file.path.match(/\/style\/v2-compatible-rest\.less$/)
        ) {
          transformLess(file.path)
            .then(css => {
              file.contents = Buffer.from(css);
              file.path = file.path.replace(/\.less$/, '.css');
              this.push(file);
              next();
            })
            .catch(e => {
              console.error(e);
            });
        } else {
          next();
        }
      }),
    )
    .pipe(gulp.dest(module == false ? esDir : libDir));
  const assets = gulp
    .src(['components/**/**.@(png|svg)'])
    .pipe(gulp.dest(module === false ? esDir : libDir));
  const source = ['components/**/*.js', 'components/**/*.jsx', '!components/*/__tests__/*'];
  const jsFilesStream = babelify(gulp.src(source), modules);

  return merge2([less, jsFilesStream, assets]);
}

function tag() {
  console.log('tag --start--');
  const {
    version,
  } = packageJson;
  execSync(`git tag ${version}`);
  console.log('tag --end--');
}
//43715a06f86b87e8ff70c56274c2f3a18f2cf7ac
function githubRelease(done) {
  const changelogFiles = [path.join(cwd, 'CHANGELOG.md')];
  // if (!process.env.GITHUB_TOKEN) {
  //   console.log('no github token found');
  //   return;
  // }
  if (!changelogFiles.every(file => fs.existsSync(file))) {
    console.log('no changelog found');
    return;
  }
  const github = new GitHub();
  github.authenticate({
    type: 'oauth',
    token: '43715a06f86b87e8ff70c56274c2f3a18f2cf7ac',
  });

  const date = new Date();
  const {
    version,
  } = packageJson;

  const changelogText = getChangelog(changelogFiles[0], version);
  const changelog = [
    `\`${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}\``,
    changelogText,
    '\n',
  ].join('\n');
  const [_, owner, repo] = execSync('git remote get-url origin')
    .toString()
    .match(/github.com[:/](.+)\/(.+)\.git/);
  // .match(/github.com[:/](.+)\/(.+)\.git/); // eslint-disable-lin
  console.log(_, owner, repo);
  github.repos
    .createRelease({
      owner,
      repo,
      tag_name: version,
      name: version,
      body: changelog,
    })
    .then(() => {
      done();
    });
}
gulp.task(
  'tag',
  gulp.series(done => {
    tag();
    githubRelease(done);
  }),
);
gulp.task(
  'check-git',
  gulp.series(done => {
    runCmd('git', ['status', '--porcelain'], (code, result) => {
      if (/^\?\?/m.test(result)) {
        return done(`there are untracked files in the working tree. \n ${result}`);
      }
      if (/^([ADRM]| [ADRM])/m.test(result)) {
        return done(`There are uncommitted changes in the working tree. \n ${result}`);
      }
      return done();
    });
  })
);

function publish(tagString, done) {
  let args = ['publish', '--with-tools'];
  if (tagString) {
    args = args.cooncat(['--tag', tagString]);
  }
  const publishNpm = process.env.PUBLISH_NPM_CLI || 'npm';
  runCmd(publishNpm, args, code => {
    tag();
    githubRelease(() => {
      done();
    });
  });
}

function pub(done) {
  dist(code => {
    if (code) {
      done(code);
      return;
    }
    const notOK = !packageJson.version.match(/^\d+\.\d+\.\d+$/);
    let tagString;
    if (argv['npm-tag']) {
      tagString = argv['npm-tag'];
    }
    if (!tagString && notOk) {
      tagString = 'next';
    }
    if (packageJson.scripts['pre-publish']) {
      runCmd('npm', ['run', 'pre-publish'], code2 => {
        if (code2) {
          done(code2);
          return;
        }
        publish(tagString, done);
      });
    } else {
      publish(tagString, done);
    }
  });
}

gulp.task('compile-with-es', gulp.series(done => {
  compile(false).on('finish', function () {
    done();
  });
}));
gulp.task(
  'compile',
  gulp.series('compile-with-es', done => {
    compile().on('finish', function () {
      done();
    });
  }),
);
gulp.task('dist', gulp.series('compile', done => {
  dist(done);
}));
gulp.task('pub', gulp.series('check-git', 'compile', done => {
  if (!process.env.GITHUB_TOKEN) {
    console.log('no github token found;');
  } else {
    pub(done);
  }
}));
gulp.task('pub-with-cli', gulp.series(done => {
  if (!process.env.NPM_TOKEN) {
    console.log('no npm token found;');
  } else {
    const github = new GitHub();
    github.authenticate({
      type: 'oauth',
      token: process.env.GITHUB_TOKEN,
    });
    const [_, owner, repo] = execSync('git remote get-url origin') // eslint-disable-line
      .toString()
      .match(/github.com[:/](.+)\/(.+)\.git/);
    const getLatestRelease = github.repos.getLatestRelease({
      owner,
      repo,
    });
    const listCommits = github.repos.listCommits({
      owner,
      repo,
      per_page: 1,
    });
    Promise.all([getLatestRelease, listCommits]).then(([latestRelease, commits]) => {
      const preVersion = latestRelease.data.tag_name;
      const {
        version,
      } = packageJson;
      const [_, newVersion] = commits.data[0].commit.message.trim().match(/bump (.+)/) || []; // eslint-disable-line
      if (
        compareVersions(version, preVersion) === 1 &&
        newVersion &&
        newVersion.trim() === version
      ) {
        runCmd('npm', ['run', 'pub'], code => {
          done();
        });
      } else {
        console.log('donot need publish' + version);
      }
    });
  }
}));
gulp.task(
  'guard',
  gulp.series(done => {
    function reportError() {
      console.log(chalk.bgRed('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
      console.log(chalk.bgRed('!! `npm publish` is forbidden for this package. !!'));
      console.log(chalk.bgRed('!! Use `npm run pub` instead.        !!'));
      console.log(chalk.bgRed('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
    }
    const npmArgs = getNpmArgs();
    if (npmArgs) {
      for (let arg = npmArgs.shift(); arg; arg = npmArgs.shift()) {
        if (/^pu(b(l(i(sh?)?)?)?)?$/.test(arg) && npmArgs.indexOf('--with-antd-tools') < 0) {
          reportError();
          done(1);
          return;
        }
      }
    }
    done();
  }),
);