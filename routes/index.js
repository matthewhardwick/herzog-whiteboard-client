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

exports.addscope = function () {
    return function (req, res) {
        var scope = new Scope(req.body);
        scope.status.push({
            assignment: req.body.assignment || "",
            priority: req.body.priority || "",
            updated: Date.now()
        });
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

exports.manage = function (settings, boardTypes, priorityLevel) {
    return function (req, res) {
        var viewModel = {
            settings: settings,
            assignment: boardTypes,
            priorityLevel: priorityLevel
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

exports.updatescope = function () {
    return function (req, res) {
        Scope.findOne({serial: req.body.serial}).exec(
            function (err, doc) {
                if (!!doc) {
                    if (!!req.body.assignment)
                        doc.assignment = req.body.assignment;
                    if (!!req.body.priority)
                        doc.priority = req.body.priority;
                    if (!!req.body.serial)
                        doc.serial = req.body.serial;
                    if (!!req.body.hospital)
                        doc.hospital = req.body.hospital;

                    if (!!req.body.assignment || !!req.body.priority)
                        doc.status.push({
                            assignment: doc.assignment,
                            priority: doc.priority,
                            updated: Date.now()
                        });
                    doc.save(function (err) {
                        if (err)
                            console.log(err);
                        else
                            console.log(doc);

                        res.redirect('/manage');

                    })
                }
            }
        );
    }
}

exports.deletescope = function () {
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