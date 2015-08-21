var express = require("express");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var _= require("underscore-node");
//Git is acting up. I'm waving my white flag.
module.exports = function(port, db, githubAuthoriser) {
    var app = express();
    app.listen();
    var http = require("http").Server(app);
    var io = require("socket.io")(http);
    //TODO create an array of users, so I can emit to specific ones

    app.use(express.static("public"));
    app.use(bodyParser.json());
    app.use(cookieParser());

    var users = db.collection("users");
    var conversations = db.collection("conversations");
    var groups = db.collection("groups");
    var sessions = {};

    http.listen(3000, function() {
        console.log("listening on *:3000");
    });

    io.on("connection", function(socket) {
        console.log("a user connected");
        socket.on("disconnect", function() {
            console.log("user disconnected");
        });
        socket.on("private message", function(user, from, msg) {
            console.log("to: ");
            console.log(user);
            console.log("message: ");
            console.log(msg);
            var messageReceiver = user.id;
            console.log(messageReceiver + " " + msg.sent + " " + msg.body + " " + from._id);
            conversations.insert({
                to: messageReceiver,
                sent: msg.sent,
                body: msg.body,
                from: from._id,
                seen: false
            });
            io.emit("update", user, from, msg);
        });
        socket.on("create group", function(groupCreate, admin) {
            console.log(groupCreate);
            console.log(admin);
            var groupId = groupCreate.id;
            if (groupCreate.title) {
                groups.findOne({
                    _id: groupId
                }, function(err, group) {
                    console.log("Found group: " + group);
                    if (group !== null) {
                        console.log("Editing group title");
                        groups.update(
                            { _id: groupId},
                            { $set: {title: groupCreate.title}}
                        );
                        res.sendStatus(200);
                    } else {
                        console.log("Inserting group");
                        groups.insertOne(
                            {
                                _id: groupId,
                                title: groupCreate.title,
                                users: [admin._id]
                            },
                            {   $addToSet: {users: admin._id}}
                        );
                        io.emit("group created", group);
                    }
                });
            } else {
                io.emit("group create failed", group);
            }
        });
        socket.on("error", function(err) {
            console.error(err.stack);
        });
    });

    app.get("/oauth", function(req, res) {
        githubAuthoriser.authorise(req, function(githubUser, token) {
            if (githubUser) {
                users.findOne({
                    _id: githubUser.login
                }, function(err, user) {
                    if (!user) {
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
        conversations.find().toArray(function(err, docs) {
            if (!err) {
                docs = docs.filter(function(conversation) {
                    if ((conversation.to === userId && conversation.from === req.session.user) ||
                        (conversation.to === req.session.user && conversation.from === userId) && conversation.sent) {
                        return conversation;
                    }
                });
                //console.log("After filte");
                //console.log(docs);
                docs = docs.sort(function(a, b) {return b.sent - a.sent;});
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

    app.get("/api/groups/conversations/:id", function(req, res) {
        var conversationId = req.params.id;
        conversations.find().toArray(function(err, docs) {
            if (!err) {
                docs = docs.filter(function(conversation) {
                    if ((conversation.to === conversationId) && conversation.sent) {
                        return conversation;
                    }
                });
                docs = docs.sort(function(a, b) {return b.sent - a.sent;});
                res.json(docs.map(function(conversation) {
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
                    if ((conversation.to === req.session.user) &&
                        (conversation.to !== conversation.from) && conversation.sent) {
                        return conversation;
                    }
                });
                docs = docs.sort(function(a, b) {
                    var temp = b.from - a.from;
                    return temp === 1? b.sent - a.sent : temp;
                });
                var arrayOfObjects = [];
                for (var j = 0; j < docs.length - 1; j++) {
                    var smallObject = docs[j];
                    for (var i = j + 1; i <= docs.length - 1; i++) {
                        if (smallObject.from === docs[i].from) {
                            if (smallObject.sent < docs[i].sent) {
                                smallObject = docs[i];
                                smallObject.index = i;
                            }
                        } else {
                            j = i;
                            break;
                        }
                    }
                    j = smallObject.index + 1;
                    arrayOfObjects.push(smallObject);
                }
                //TODO FOR LOOP
                for (var i = 0; i < arrayOfObjects.length; i++) {
                    docs.splice(i, arrayOfObjects[i].index);
                }
                docs.splice(arrayOfObjects.length - 1, docs.length - 1);

                console.log("After sort and remove duplicates");
                console.log(docs);
                res.json(docs.map(function(conversation) {
                    return {
                        user: conversation.from,
                        lastMessage: conversation.sent,
                        anyUnseen: !conversation.seen
                    };
                }));
            } else {
                res.sendStatus(500);
            }
        });
    });

    app.put("/api/conversations/:id", function(req, res) {
        var messageSender = req.params.id;
        if (req.body.seen) {
            conversations.update(
                {from: messageSender, to: req.session.user, seen: false},
                {$set: {seen: true}},
                {multi: true}
            );
            res.sendStatus(200);
        } else {
            res.sendStatus(500);
        }
    });

    app.put("/api/groups/conversations/:id", function(req, res) {
        var messageSender = req.params.id;
        console.log(messageSender + " " + req.body.seen + " " + req.session.user);
        if (req.body.seen) {
            conversations.update(
                {to: messageSender, from: { $ne: req.session.user}, seen: false},
                {$set: {seen: true}},
                {multi: true}, function(err, response) {
                    if (!err) {
                        res.sendStatus(200);
                    } else {
                        res.sendStatus(404);
                    }
                }
            );
        } else {
            res.sendStatus(500);
        }
    });

    app.post("/api/conversations/:id", function(req, res) {
        var messageReceiver = req.params.id;
        console.log(messageReceiver + " " + req.body.sent + " " + req.body.body + " " + req.session.user);
        conversations.insert({
            to: messageReceiver,
            sent: req.body.sent,
            body: req.body.body,
            from: req.session.user,
            seen: false
        });
        res.sendStatus(201);
    });

    app.put("/api/groups/:id", function(req, res) {
        var groupId = req.params.id;
        if (req.body.title) {
            groups.findOne({
                _id: groupId
            }, function(err, group) {
                console.log("Found group: " + group);
                if (group !== null) {
                    console.log("Editing group title");
                    groups.update(
                        { _id: groupId},
                        { $set: {title: req.body.title}}
                    );
                    res.sendStatus(200);
                } else {
                    console.log("Inserting group");
                    groups.insertOne(
                        {
                            _id: groupId,
                            title: req.body.title,
                            users: [req.session.user]
                        },
                        {   $addToSet: {users: req.session.user}}
                    );
                    res.sendStatus(201);
                }
            });
        } else {
            res.sendStatus(500);
        }
    });

    app.get("/api/groups", function(req, res) {
        var authenticatedUser = req.session.user;
        groups.find().toArray(function(err, docs) {
            if (!err) {
                //TODO return the groups for authenticated user
                docs = docs.filter(function(group) {
                    var userExists = false;
                    if (group.users) {
                        for (var j = 0; j < group.users.length; j++) {
                            if (group.users[j] === authenticatedUser) {
                                userExists = true;
                            }
                        }
                        if (userExists) {
                            return group;
                        }
                    }
                });
                res.json(docs.map(function(group) {
                    return {
                        id: group._id,
                        title: group.title
                    };
                }));
            } else {
                res.sendStatus(500);
            }
        });
    });

    app.get("/api/groups/:id", function(req, res) {
        groups.findOne({
            _id: req.params.id
        }, {_id: 1, title: 1}, function(err, group) {
            if (group !== null) {
                res.json(group);
            } else {
                res.sendStatus(404);
            }
        });

    });

    app.delete("/api/groups/:id", function(req, res) {
        console.log("Request to remove id: " + req.params.id);
        // TODO Have a callback running
        groups.remove(
            {_id: req.params.id}, {w:1}, function(err, result) {
                console.log("err");
                console.log(err);
                console.log("result");
                console.log(result);
                if (!err) {
                        console.log("Deleted");
                        res.sendStatus(200);
                } else {
                    console.log("Not Found");
                    res.sendStatus(404);
                }
        });
    });

    app.put("/api/groups/:groupId/users/:id", function(req, res) {
        users.findOne({
            _id: req.params.id
        }, function(err, user) {
            if (!err) {
                console.log("Found user: ");
                console.log(user);
                groups.findOne({
                    _id: req.params.groupId
                }, function(err, group) {
                    if (!err) {
                        console.log("Found group: ");
                        console.log(group);
                        groups.update(
                            { _id: req.params.groupId },
                            { $addToSet: {users: req.params.id}}
                        );
                        res.sendStatus(201);
                    } else {
                        console.log("Group not found");
                        res.sendStatus(404);
                    }
                })
            } else {
                console.log("User not found");
                res.sendStatus(500);
            }
        })
    });

    app.get("/api/groups/:groupId/users", function(req, res) {
        groups.findOne({
            _id: req.params.groupId
        }, {_id: 0, users: 1}, function(err, group) {
            if (group !== null) {
                res.send(group.users);
            } else {
                res.sendStatus(404);
            }
        })
    });

    app.delete("/api/groups/:groupId/users/:id", function(req, res) {
        groups.findOne({
            _id: req.params.groupId
        }, function(err, group) {
            if (group !== null) {
                var groupUsers = group.users;
                groupUsers = groupUsers.filter(function(item) {
                    if (item !== req.params.id) {
                        return item;
                    }
                });
                console.log(groupUsers.length);
                if(groupUsers.length === 0) {
                    groups.remove(
                        {_id: req.params.groupId}, {w:1}, function(err, result) {
                            console.log("err");
                            console.log(err);
                            console.log("result");
                            console.log(result);
                            if (!err) {
                                console.log("Deleted");
                                res.sendStatus(200);
                            } else {
                                console.log("Not Found");
                                res.sendStatus(404);
                            }
                        });
                } else {
                    groups.update(
                        {_id: req.params.groupId},
                        {$set: {users: groupUsers}},
                        {w: 1, wtimeout: 5000, multi: false}, function (err, response) {
                            if (!err) {
                                if (response.result.nModified > 0) {
                                    console.log("Removed user");
                                    res.sendStatus(200);
                                } else {
                                    console.log("No user to remove");
                                    res.sendStatus(204);
                                }
                            }
                        }
                    );
                }
            } else {
                res.sendStatus(404);
            }
        })
    });

    return app.listen(port);
};
