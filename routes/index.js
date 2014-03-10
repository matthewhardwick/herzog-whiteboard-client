var mongoose = require('mongoose');
var moment = require('moment');

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
        hideNav: true,
        user: req.user,
        message: req.session.messages
    });
};

exports.get_logout = function(req, res){
    req.logout();
    res.redirect('/');
};

exports.whiteboard = function(settings, boardTypes, priorityLevel) {
    return function(req, res) {
        var viewModel = {
            settings: settings,
            boardTypes: boardTypes
        };

        for (var idx in boardTypes)
            viewModel[idx] = [];

        Scope.find({}, {}, function(e, docs) {

            for (var idx in docs)
                if (!!viewModel[docs[idx].assignment])
                    viewModel[docs[idx].assignment].push(docs[idx])

            for (var key in boardTypes)
                sortByPriority(viewModel[key], priorityLevel)

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
                req.session.messages = "Unable to add " + req.body.serial;
            } else {
                req.session.messages = req.body.serial + " Sucessfully Added";
            }
            res.redirect('/manage');
        });
    }
};

exports.manage = function (settings, boardTypes, priorityLevel, inactive) {
    return function (req, res) {
        var viewModel = {
            settings: settings,
            assignment: boardTypes,
            priorityLevel: priorityLevel,
            inactive: inactive,
            message: req.session.messages
        }
        req.session.messages = "";
        if (!inactive)
            Scope.find({assignment: {$ne: 'na'}}, {}, function (e, docs) {
                viewModel.scopes = docs;
                sortByKey(viewModel.scopes, "serial");
                res.render('manage', {
                    'viewModel': viewModel
                })
            });
        else
            Scope.find({assignment: "na" }, {}, function (e, docs) {
                viewModel.scopes = docs;
                sortByKey(viewModel.scopes, "serial");
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
                    if (!!req.body.new_serial)
                        doc.serial = req.body.new_serial;
                    else if (!!req.body.serial)
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
                        if (err) {
                            console.log(err);
                            req.session.messages = "Unable to update " + doc.serial;
                        } else {
                            console.log(doc);
                            req.session.messages = doc.serial + " Sucessfully Updated";
                        }

                        res.redirect('/manage');

                    })
                }
            }
        );
    }
}

exports.manage_scope = function(settings, boardTypes, priorityLevel) {
    return function (req, res) {
        Scope.findOne({serial: req.params.serial}, {}, function (err, docs) {
            if (!!docs) {
                var viewModel =  {
                  settings      : settings,
                  boardTypes    : boardTypes,
                  priorityLevel : priorityLevel,
                  scope         : docs,
                  message       : req.session.messages
                };
                for (var idx in viewModel.scope.status) {
                    if (!!viewModel.scope.status[idx].updated) {
                        var date = new Date(viewModel.scope.status[idx].updated);
                        viewModel.scope.status[idx].updated_time = date;
                    }
                }
                req.session.messages = "";
                res.render('manage_scope', {
                    'viewModel': viewModel
                });
            } else {
                req.session.messages = "Unable to Find Scope: " + req.params.serial;
                res.redirect('/manage');
            }
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

function sortByPriority(array, priorityLevel) {
    return array.sort(function (a, b) {
        var pri1 = a.priority;
        var pri2 = b.priority;
        if (pri1 === "high")
            return -1;
        else if (pri2 === "high")
            return 1;
        else if (pri1 === "norm")
            return -1;
        else if (pri2 === "norm")
            return 1
        return 0;
    });
}