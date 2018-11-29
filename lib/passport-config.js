const LocalStrategy = require('passport-local').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/user');

module.exports = function(passport) {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) =>  {
    User.findById(id, done);
  });

  passport.use('local-signin', new LocalStrategy({
    usernameField : 'email',
    passwordField : 'password',
    passReqToCallback : true
  }, async (req, email, password, done) => {
    try {
      const user = await User.findOne({email: email});
      if (user && await user.validatePassword(password)) {
        return done(null, user, req.flash('success', 'Welcome!'));
      }
      return done(null, false, req.flash('danger', 'Invalid email or password'));
    } catch(err) {
      done(err);
    }
  }));
  const callbackURL = (process.env.NODE_ENV == 'production')?
   'https://sleepy-anchorage-66618.herokuapp.com/auth/facebook/callback' :
   'http://localhost:3000/auth/facebook/callback';

  console.log("NODE ENV = ", process.env.NODE_ENV);
  console.log("CALLBACK URL = ", callbackURL);
  passport.use(new FacebookStrategy({
    // 이 부분을 여러분 Facebook App의 정보로 수정해야 합니다.
    clientID : process.env.FBID ||'2250953771895712',
    clientSecret : process.env.FB_SECRETE ||'03f09a9bce75c6942713e18c3b93fcc9',
    callbackURL : callbackURL,
    profileFields : ['email', 'name', 'picture']
  }, async (token, refreshToken, profile, done) => {
    console.log('Facebook', profile); // profile 정보로 뭐가 넘어오나 보자.
    try {
      var email = (profile.emails && profile.emails[0]) ? profile.emails[0].value : ''; //profile.emails이메일이 없는 경우 -
      var picture = (profile.photos && profile.photos[0]) ? profile.photos[0].value : '';
      var name = (profile.displayName) ? profile.displayName : 
        [profile.name.givenName, profile.name.middleName, profile.name.familyName]
          .filter(e => e).join(' ');
      console.log(email, picture, name, profile.name);
      // 같은 facebook id를 가진 사용자가 있나?
      var user = await User.findOne({'facebook.id': profile.id});  // 그 어쩌고 djif3392409이런 거 
      if (!user) {
        // 없다면, 혹시 같은 email이라도 가진 사용자가 있나? , 있으면 같은 아이디 가진 사람이구나 하면 된다 
        if (email) {
          user = await User.findOne({email: email});
        }
        if (!user) {
          // 그것도 없다면 새로 만들어야지. 없으면 이메일 만들기 
          user = new User({name: name});
          user.email =  email ? email : `__unknown-${user._id}@no-email.com`;
        }
        // facebook id가 없는 사용자는 해당 id를 등록
        user.facebook.id = profile.id;
        user.facebook.photo = picture;
      }
      user.facebook.token = profile.token;
      await user.save();
      return done(null, user);//있으면 이렇게 한다 
    } catch (err) {
      done(err);
    }
  }));
};
