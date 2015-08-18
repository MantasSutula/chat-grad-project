var express = require("express");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");

module.exports = function(port, db, githubAuthoriser) {
    var app = express();

    app.use(express.static("public"));
    app.use(bodyParser.json());
    app.use(cookieParser());

    var users = db.collection("users");
    var conversations = db.collection("conversations");
    var sessions = {};

    app.get("/oauth", function(req, res) {
        githubAuthoriser.authorise(req, function(githubUser, token) {
            if (githubUser) {
                users.findOne({
                    _id: githubUser.login
                }, function(err, user) {
                    if (!user) {
                        // TODO: Wait for this operation to complete
                        users.insertOne({
                            _id: githubUser.login,
                            name: githubUser.name,
                            avatarUrl: githubUser.avatar_url
                        });
                    }
                    sessions[token] = {
                        user: githubUser.login
                    };
                    res.cookie("sessionToken", token);
                    res.header("Location", "/");
                    res.sendStatus(302);
                });
            }
            else {
                res.sendStatus(400);
            }

        });
    });

    app.get("/api/oauth/uri", function(req, res) {
        res.json({
            uri: githubAuthoriser.oAuthUri
        });
    });

    app.use(function(req, res, next) {
        if (req.cookies.sessionToken) {
            req.session = sessions[req.cookies.sessionToken];
            if (req.session) {
                next();
            } else {
                res.sendStatus(401);
            }
        } else {
            res.sendStatus(401);
        }
    });

    app.get("/api/user", function(req, res) {
        users.findOne({
            _id: req.session.user
        }, function(err, user) {
            if (!err) {
                res.json(user);
            } else {
                res.sendStatus(500);
            }
        });
    });

    app.get("/api/users", function(req, res) {
        users.find().toArray(function(err, docs) {
            if (!err) {
                res.json(docs.map(function(user) {
                    return {
                        id: user._id,
                        name: user.name,
                        avatarUrl: user.avatarUrl
                    };
                }));
            } else {
                res.sendStatus(500);
            }
        });
    });

    app.get("/api/conversations/:id", function(req, res) {
        var userId = req.params.id;
        //console.log(req.params);
        conversations.find().toArray(function(err, docs) {
            if (!err) {
                docs = docs.filter(function(conversation) {
                    if ((conversation.to === userId && conversation.from === req.session.user) ||
                        (conversation.to === req.session.user && conversation.from === userId) && conversation.sent) {
                        //console.log(conversation);
                        return conversation;
                    }
                });
                docs = docs.sort(function(a, b){return b.sent - a.sent;});
                //res.json(docs);
                //res.json(docs.map(function(conversation) {
                res.json(docs.map(function(conversation) {
                    //console.log("Comparing: " + conversation.to + " and " +
                    //    conversation.from +  " to: " + userId);
                    //if ((conversation.to === userId && conversation.from === req.session.user) ||
                    //    (conversation.to === req.session.user && conversation.from === userId)) {
                    //    console.log(conversation);
                        //return conversation;
                    return {
                        sent: conversation.sent,
                        body: conversation.body,
                        seen: conversation.seen,
                        from: conversation.from
                    };
                    //}
                }));
            } else {
                res.sendStatus(500);
            }
        });
    });

    app.get("/api/conversations", function(req, res) {
        conversations.find().toArray(function(err, docs) {
            if (!err) {
                docs = docs.filter(function(conversation) {
                    if (((conversation.from === req.session.user && conversation.to) ||
                        conversation.to === req.session.user ) && conversation.sent) {
                        //console.log(conversation);
                        return conversation;
                    }
                });
                res.json(docs.map(function(conversation) {
                    console.log(conversation);
                    return {
                        to: conversation.to,
                        from: conversation.from,
                        lastMessage: conversation.sent,
                        anyUnseen: conversation.anyUnseen
                    };
                }));
            } else {
                res.sendStatus(500);
            }
        });
    });

    app.put("/api/conversations/:id", function(req, res) {
        var messageReceiver = req.params.id;
        //console.log(messageReceiver + " " + req.body.seen + " " + req.session.user);
        if (req.body.seen) {
            //console.log("Entering if loop to update seen");
            //conversations.findAndModify({
            //    query: {from: messageReceiver, to: req.session.user},
            //    sort: {seen: false},
            //    update: {$set: {seen: true}},
            //    upsert: false
            //});
            conversations.update(
                {from: messageReceiver, to: req.session.user},
                {$set: {seen: true}},
                {multi:true}
                );
            //console.log("Finished if loop to update seen");
            res.sendStatus(200);
        } else {
            //console.log("Triggered 500 error");
            res.sendStatus(500);
        }
    });

    app.post("/api/conversations/:id", function(req, res) {
        var messageReceiver = req.params.id;
        //console.log(messageReceiver + " " + req.body.sent + " " + req.body.body + " " + req.session.user);
        conversations.insert({
            to: messageReceiver,
            sent: req.body.sent,
            body: req.body.body,
            from: req.session.user,
            seen: false
        });
        res.sendStatus(201);
    });

    return app.listen(port);
};
