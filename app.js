

var settings = {
    isDebug: false,
    isAdminMode: true,
    ShowCreditHold: true,
    EmployeeNames: {
        emp1: "Luis",
        emp2: "Jeremy #2",
        emp3: "Other 1",
        emp4: "Jeremy #1",
        emp5: "Other 2 / QC"
    }
}

var priorityLevel = {
    low : "Low",
    norm: "Normal",
    high: "High"
};

var boardTypes = {
    wfp: "Waiting For Parts",
    rfw: "Ready For Work",
    pr: "Partial Repair",
    an: "Approval Needed",
    loaners: "Loaners",
    credithold: "Credit Hold",
    disassemble: "Disassemble",
    emp1: settings.EmployeeNames.emp1,
    emp2: settings.EmployeeNames.emp2,
    emp3: settings.EmployeeNames.emp3,
    emp4: settings.EmployeeNames.emp4,
    emp5: settings.EmployeeNames.emp5,
    na: "Inactive"
}

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;
var bcrypt = require('bcrypt');
var SALT_WORK_FACTOR = 10;

var scopeStatusSchema = new Schema({
    assignment  : { type: String, required: true },
    priority    : { type: String, required: true },
    updated     : { type: Date, required: true, default: Date.now() }
});

var scopeSchema = new Schema({
    serial      : { type: String, required: true, unique: true },
    hospital    : { type: String },
    assignment  : { type: String, required: true },
    priority    : { type: String, required: true },
    status      : [ scopeSchema ],
    date        : { type: Date, required: true, default: Date.now() }
});

var userSchema = new Schema({
    username    : { type: String, required: true, unique: true },
    email       : { type: String, required: true, unique: true },
    password    : { type: String, required: true }
});


// Authentication Password encryption

// Bcrypt middleware
userSchema.pre('save', function(next) {
    var user = this;

    if(!user.isModified('password')) return next();

    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        if(err) return next(err);

        bcrypt.hash(user.password, salt, function(err, hash) {
            if(err) return next(err);
            user.password = hash;
            next();
        });
    });
});

// Password verification
userSchema.methods.comparePassword = function(candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
        if(err) return cb(err);
        cb(null, isMatch);
    });
};

var Scope = mongoose.model( 'Scope', scopeSchema );
var User = mongoose.model( 'User', userSchema );
var ScopeStatus = mongoose.model( 'ScopeStatus', scopeStatusSchema );


/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');


var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({ secret: '37c5590beaf124698c13edb0f89f13498362411b64bf98b0a87811e4e3f4999b' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));


// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

var mongoUri = process.env.MONGOLAB_URI ||
    process.env.MONGOHQ_URL ||
    'mongodb://localhost/herzogdb';

mongoose.connect( mongoUri );

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});

passport.use(new LocalStrategy(function(username, password, done) {
    User.findOne({ username: username }, function(err, user) {
        if (err) { return done(err); }
        if (!user) { return done(null, false, { message: 'Unknown user ' + username }); }
        user.comparePassword(password, function(err, isMatch) {
            if (err) return done(err);
            if(isMatch) {
                return done(null, user);
            } else {
                return done(null, false, { message: 'Invalid password' });
            }
        });
    });
}));

function ensureAuthenticated(req, res, next) {
    if (settings.isDebug) { return next(); }
    if (req.isAuthenticated()) { return next(); }
    res.redirect('/login')
}

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {
    console.log('Connected to DB');
});


// Routing Information
app.get('/', ensureAuthenticated, routes.index);
app.get('/login', routes.get_login);
app.get('/whiteboard', ensureAuthenticated, routes.whiteboard(settings, boardTypes, priorityLevel));
app.get('/manage', ensureAuthenticated, routes.manage(settings, boardTypes, priorityLevel, false));
app.get('/manage/inactive', ensureAuthenticated, routes.manage(settings, boardTypes, priorityLevel, true));
app.get('/manage/scope/:serial', ensureAuthenticated, routes.manage_scope(settings, boardTypes, priorityLevel));
app.get('/logout', ensureAuthenticated, routes.get_logout);
//app.get('/updatepassword', ensureAuthenticated, routes.get_updatepassword(passport));
app.get('/adduser', ensureAuthenticated, routes.get_adduser(settings));

app.post('/adduser', ensureAuthenticated, routes.post_adduser(settings));
//app.post('/updatepassword', routes.post_updatepassword(passport));
app.post('/login', routes.post_login(passport));
app.post('/addscope', ensureAuthenticated, routes.addscope());
app.post('/updatescope', ensureAuthenticated, routes.updatescope());
//app.post('/deletescope', ensureAuthenticated, routes.deletescope());


http.createServer(app).listen(app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
});
