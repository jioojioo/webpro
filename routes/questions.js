const express = require('express');
const Question = require('../models/question');
const Answer = require('../models/answer'); 
const catchErrors = require('../lib/async-error');


module.exports = io => {
  const router = express.Router();
  
  // 동일한 코드가 users.js에도 있습니다. 이것은 나중에 수정합시다.
  function needAuth(req, res, next) {
    if (req.isAuthenticated()) {
      next();
    } else {
      req.flash('danger', 'Please signin first.');
      res.redirect('/signin');
    }
  }

  /* GET questions listing. */
  router.get('/', catchErrors(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    var query = {};
    const term = req.query.term;
    if (term) {
      query = {$or: [
        {title: {'$regex': term, '$options': 'i'}},
        {content: {'$regex': term, '$options': 'i'}}
      ]};
    }
    const questions = await Question.paginate(query, {
      sort: {createdAt: -1}, 
      populate: 'author', 
      page: page, limit: limit
    });
    res.render('questions/index', {questions: questions, term: term, query: req.query});
  }));

  router.get('/new', needAuth, (req, res, next) => {
    res.render('questions/new', {question: {}});
  });

  router.get('/:id/edit', needAuth, catchErrors(async (req, res, next) => {
    const question = await Question.findById(req.params.id);
    res.render('questions/edit', {question: question});
  }));

  router.get('/:id', catchErrors(async (req, res, next) => {
    const question = await Question.findById(req.params.id).populate('author');
    const answers = await Answer.find({question: question.id}).populate('author');
    question.numReads++;    // TODO: 동일한 사람이 본 경우에 Read가 증가하지 않도록???

    await question.save();
    res.render('questions/show', {question: question, answers: answers});
  }));

  router.put('/:id', catchErrors(async (req, res, next) => {
    const question = await Question.findById(req.params.id);

    if (!question) {
      req.flash('danger', 'Not exist question');
      return res.redirect('back');
    }
    question.title = req.body.title;
    question.content = req.body.content;
    question.number = req.body.number;
    question.sponsor = req.body.sponsor;
    question.applicant = req.body.applicant;
    question.period = req.body.period;
    question.charger = req.body.charger;
    question.tags = req.body.tags.split(" ").map(e => e.trim());
    question.img = req.body.img;//*c/
    await question.save();
    req.flash('success', 'Successfully updated');
    res.redirect('/questions');
  }));

  router.delete('/:id', needAuth, catchErrors(async (req, res, next) => {
    await Question.findOneAndRemove({_id: req.params.id});
    req.flash('success', 'Successfully deleted');
    res.redirect('/questions');
  }));

  router.post('/', needAuth, catchErrors(async (req, res, next) => {
    console.log(req.body);//*c
    const user = req.user;
    var question = new Question({
      title: req.body.title,
      author: user._id,
      content: req.body.content,
      number: req.body.number,
      sponsor: req.body.sponsor,
      applicant: req.body.applicant,
      period: req.body.period,
      charger: req.body.charger,
      img: req.body.img,
      tags: req.body.tags.split(" ").map(e => e.trim()),
    });
    await question.save();
    req.flash('success', 'Successfully posted');
    res.redirect('/questions');
  }));

  router.post('/:id/answers', needAuth, catchErrors(async (req, res, next) => {
    const user = req.user;
    const question = await Question.findById(req.params.id);

    if (!question) {
      req.flash('danger', 'Not exist question');
      return res.redirect('back');
    }

    var answer = new Answer({
      author: user._id,
      question: question._id,
      content: req.body.content
    });
    await answer.save();
    question.numAnswers++;
    await question.save();

    const url = `/questions/${question._id}#${answer._id}`;
    io.to(question.author.toString())
      .emit('answered', {url: url, question: question});
    console.log('SOCKET EMIT', question.author.toString(), 'answered', {url: url, question: question})
    req.flash('success', 'Successfully answered');
    res.redirect(`/questions/${req.params.id}`);
  }));

  return router;
}