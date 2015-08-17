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
        console.log(req.params);
        conversations.find().toArray(function(err, docs) {
            if (!err) {
                docs = docs.sort({sent: -1});
                console.log("After sort");
                console.log(docs);
                //res.json(docs.map(function(conversation) {
                res.json(docs.filter(function(conversation) {
                    console.log("Comparing: " + conversation.to + " and " +
                        conversation.from +  " to: " + userId);
                    if ((conversation.to === userId && conversation.from === req.session.user) ||
                        (conversation.to === req.session.user && conversation.from === userId)) {
                        console.log(conversation);
                        return conversation; //{
                        //sent: conversation.sent,
                        //body: conversation.body,
                        //seen: conversation.seen,
                        //from: conversation.from
                        //}
                    }
                }));
            } else {
                res.sendStatus(500);
            }
        });
    });

    app.get("/api/conversations", function(req, res) {
        conversations.find().toArray(function(err, docs) {
            if (!err) {
                console.log("Docs ALL:");
                console.log(docs);
                console.log("Docs Done!");
                res.json(docs.map(function(conversation) {
                    console.log(conversation);
                    return {
                        user: conversation.userName,
                        lastMessage: conversation.lastMessage,
                        anyUnseen: conversation.anyUnseen
                    };
                }));
            } else {
                res.sendStatus(500);
            }
        });
    });

    app.put("/api/conversations/:id", function(req, res) {

    });

    app.post("/api/conversations/:id", function(req, res) {
        var conversationId = req.params.id;
        console.log(conversationId + " " + req.body.sent + " " + req.body.body + " " + req.session.user);
        conversations.insert({
            to: conversationId,
            sent: req.body.sent,
            body: req.body.body,
            from: req.session.user,
            anyUnseen: true,
            seen: false
        });
        res.sendStatus(201);
    });

    return app.listen(port);
};
