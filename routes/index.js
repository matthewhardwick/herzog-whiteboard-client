var mongoose = require('mongoose');
var moment = require('moment');
var underscore = require('underscore');

var Scope = mongoose.model('Scope');
var User = mongoose.model('User');
var ScopeRma = mongoose.model('ScopeRma');
var ScopeStatus = mongoose.model( 'ScopeStatus' );

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

exports.post_adduser = function (settings) {
    return function (req, res) {
        if (!!req.body.username && !!req.body.password && !!req.body.email && settings.isAdminMode) {
            var user = new User({
                username: req.body.username,
                password: req.body.password,
                email:    req.body.email,
                isAdmin: true
            });
            user.save(function(err) {
                if(!!err) {
                    console.log(err);
                    req.session.messages = 'Unable to create user: ' + user.username;
                } else {
                    console.log('user: ' + user.username + " saved.");
                    req.session.messages = 'user: ' + user.username + ' saved.';
                }
                res.redirect('/manage');
            });
        } else {
            req.session.messages = "Either not all fields are filled out, or not Admin.";
            res.redirect('/manage');
        }

    };
};

exports.get_manageuser = function (settings) {
    return function(req, res) {
        var viewModel = {};

        User.find({}, {}, function (err, docs) {
            if(!!docs) {
                viewModel.users = docs;
                res.render('manage_user', { viewModel: viewModel });
            }
            if(!!err) {
                console.log(err);
                res.redirect('/manage/user');
                res.session.messages = "Unable to get User List";
            }
        });
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
        scope.status.push(new ScopeStatus({
            hospital    : req.body.hospital || "",
            serial      : req.body.serial || "",
            assignment  : req.body.assignment || "",
            priority    : req.body.priority || "",
            updated     : Date.now()
        }));
        scope.save(function(err) {
            if(err) {
                console.log(err);
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
            message: req.session.messages,
            filterBy: req.query.filter
        }
        req.session.messages = "";
        if (!!req.query.filter)
            var key = underscore.invert(boardTypes)[req.query.filter];
        if (!!key)
            Scope.find({assignment: key}, {}, function (e, docs) {
                viewModel.scopes = docs;
                sortByKey(viewModel.scopes, "serial");
                res.render('manage', {
                    'viewModel': viewModel
                })
            });
        else
            Scope.find({assignment: {$ne: 'na'}}, {}, function (e, docs) {
                viewModel.scopes = docs;
                sortByKey(viewModel.scopes, "serial");
                res.render('manage', {
                    'viewModel': viewModel
                })
            });
    }
}

exports.addrma = function () {
    return function (req, res) {
        Scope.findOne({serial: req.body.serial}, {}, function (e, docs) {
            if (!!docs) {
                var rma = {
                    rma: req.body.rma || "",
                    description: req.body.description || "",
                    serial: req.body.serial || ""
                };
                if (!!docs.rmas)
                    docs.rmas.push(new ScopeRma(rma));
                else {
                    docs.rmas = [ new ScopeRma(rma) ];
                    docs.displayBySerial = true;
                }
                if (!!req.body.displayrma && req.body.displayrma) {
                    docs.displayBySerial =  false;
                    docs.activeRma = req.body.rma;
                }
                docs.save(function (err) {
                    if (err) {
                        console.log(err);
                        req.session.messages = "Unable to add RMA to " + req.body.serial;
                        res.redirect(req.header('referer'));
                    } else {
                        console.log(docs);
                        req.session.messages = req.body.serial + " Sucessfully added";
                    }

                    res.redirect(req.header('referer'));

                })
            }
        });
    }
};

exports.updaterma = function () {
  return function (req, res) {
    console.log(req.body);
    Scope.findOne({serial: req.body.serial}, {}, function (err, docs) {
       if (!!docs) {
           if ((!!req.body.new_rma || !!req.body.description) && !!docs.rmas ) {
                Scope.findOne({'rmas.rma': req.body.rma}, { 'rmas.$': 1 }, function (err, scope) {
                    if (!!err) {
                        req.session.messages = "Unable to update RMA";
                        res.redirect('/manage/scope/' + req.body.serial);
                    } else if (!!scope && !!scope.rmas[0]) {
                        var rma = scope.rmas[0];
                        if (!!req.body.new_rma)
                            rma.rma = req.body.new_rma;
                        if (!!req.body.description)
                            rma.description = req.body.description;

                        scope.save(function (err) {
                           if (!!err) {
                               req.session.messages = "Unable to update RMA";
                               res.redirect('/manage/scope/' + req.body.serial);
                           } else {
                               req.session.messages = "RMA updated";
                               res.redirect('/manage/scope/' + req.body.serial);
                           }
                        });

                    }
                });
           } else if (!!req.body.displayByRma) {
               docs.activeRma = req.body.rma;
               docs.displayBySerial = false;
               docs.save(function (err) {
                   if (!!err) {
                       req.session.messages = "Unable to set RMA to Active RMA";
                       res.redirect('/manage/scope/' + req.body.serial);
                   } else {
                       req.session.message = req.body.rma + " set to Display As RMA";
                       res.redirect('/manage/scope/' + req.body.serial);
                   }
               });
           }
       }
       if (!!err) {
           res.redirect('/manage');
       }



    });
  };
};

exports.updatescope = function (boardTypes) {
    return function (req, res) {
        Scope.findOne({serial: req.body.serial}, {}, function (err, doc) {

                if (!!doc) {
                    var updatedDisplay = false;
                    if (!!req.body.assignment)
                        doc.assignment = req.body.assignment;
                    if (!!req.body.priority)
                        doc.priority = req.body.priority;
                    if (!!req.body.hospital)
                        doc.hospital = req.body.hospital;
                    if (!!req.body.new_serial)
                        doc.serial = req.body.new_serial;
                    else if (!!req.body.serial)
                        doc.serial = req.body.serial;
                    if ((!!req.body.displayBySerial && req.body.displayBySerial) || typeof doc.displayBySerial === 'undefined') {
                        doc.displayBySerial = true;
                        doc.activeRma = "";
                        updatedDisplay = true;
                    }

                    if (!updatedDisplay)
                        doc.status.push(new ScopeStatus({
                            hospital    : doc.hospital || "",
                            serial      : doc.serial || "",
                            assignment  : boardTypes[doc.assignment] || "",
                            priority    : doc.priority || "",
                            updated     : Date.now()
                        }));
                    doc.save(function (err) {
                        if (err) {
                            console.log(err);
                            req.session.messages = "Unable to update " + doc.serial;
                        } else {
                            console.log(doc);
                            req.session.messages = doc.serial + " Sucessfully Updated";
                        }

                        if (!!req.body.new_serial)
                            res.redirect('/manage/scope/' + req.body.new_serial);
                        else
                            res.redirect(req.header('referer'));
                    })
                }

                if (!!err) {
                    console.log(err);
                    req.session.messages = "Unable to update " + req.body.serial;
                    res.redirect(req.header('referer'));
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
                        viewModel.scope.status[idx].updated_time = moment(date).format("MMM-D-YYYY, h:mm a");
                    }
                }
                req.session.messages = "";
                res.render('manage_scope', {
                    'viewModel': viewModel
                });
            } else {
                req.session.messages = "Unable to Find Scope: " + req.params.serial;
                res.redirect(req.header('referer'));
            }
        });
    }
}

exports.post_deleteuser = function () {
    return function (req, res) {
        if (req.body.username !== req.user.username)
            User.remove({username: req.body.username}, function (err) {
                if (!!err) {
                    req.session.messages = "Unable to Delete " + req.body.username;
                    res.redirect('/manage/user');
                } else {
                    req.session.messages = "Deleted: " + req.body.username;
                    res.redirect(req.header('referer'));
                }
            });
        else {
            req.session.messages = "Unable to Delete Currently Logged In User";
            res.redirect(req.header('referer'));
        }

    }
};

// Utility

function sortByKey(array, key) {
    return array.sort(function(a, b) {
        var x = a[key]; var y = b[key];
        return ((x.toUpperCase() < y.toUpperCase()) ? -1 : ((x.toUpperCase() > y.toUpperCase()) ? 1 : 0));
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