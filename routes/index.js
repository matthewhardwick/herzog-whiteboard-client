var mongoose = require('mongoose');
var Scope = mongoose.model('Scope');
var User = mongoose.model('User');

exports.index = function(req, res){
    res.redirect('/manage');
};

exports.post_login = function (passport) {
    return function(req, res, next) {
        passport.authenticate('local', function(err, user, info) {
            if (err) { return next(err) }
            if (!user) {
                req.session.messages = [info.message];
                return res.redirect('/login')
            }
            req.logIn(user, function(err) {
                if (err) { return next(err); }
                return res.redirect('/');
            });
        })(req, res, next);
    };
};

exports.get_login = function (req, res) {
    res.render('login', {
        user: req.user,
        message: req.session.messages
    });
};

exports.whiteboard = function(settings, scopeTypes) {
    return function(req, res) {
        var viewModel = {settings: settings};
        for (var idx in scopeTypes)
            viewModel[idx] = [];
        Scope.find({}, {}, function(e, docs) {
            for (var idx in docs) {
                if (!!viewModel[docs[idx].assignment])
                    viewModel[docs[idx].assignment].push(docs[idx])
            }
            res.render('whiteboard', {
                "viewModel": viewModel
            });
        });
    };
};

exports.addscope = function (boardTypes) {
    return function (req, res) {
        var scope = new Scope(req.body);
        scope.save(function(err) {
            if(err) {
                console.log(err);
            } else {
                console.log('Scope: ' + scope.serial + " saved.");
                res.redirect('/manage');
            }
        });
    }
};

exports.manage = function (settings, boardTypes) {
    return function (req, res) {
        var viewModel = {
            settings: settings,
            assignment: boardTypes
        }
        Scope.find({}, {}, function (e, docs) {
            viewModel.scopes = docs;
            sortByKey(viewModel.scopes, "assignment");
            res.render('manage', {
                'viewModel': viewModel
            })
        });
    }
}

exports.updatescope = function (settings, boardTypes) {
    return function (req, res) {
        Scope.update({serial: req.body.serial},
            {assignment: req.body.assignment},
            {upsert: true},
            function(err) {
                if(err) {
                    console.log(err);
                } else {
                    console.log('Scope: ' + req.body.serial + " updated.");
                    res.redirect('/manage');
                }
            });
    }
}

exports.deletescope = function (boardTypes) {
    return function (req, res) {
        Scope.findOne({serial: req.body.serial}, {}, function (e, docs) {
            docs.remove();
            res.redirect('/manage');
        });
    }
}

// Utility

function sortByKey(array, key) {
    return array.sort(function(a, b) {
        var x = a[key]; var y = b[key];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
};