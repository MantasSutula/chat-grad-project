(function() {
    var app = angular.module("ChatApp", []);

    app.controller("ChatController", function($scope, $http, $interval) {
        var self = this;
        $scope.loggedIn = false;
        $scope.activeChatUser = "";
        // REMOVE COMMENT TO POLL
        //$interval(reloadData, 2000);

        self.resetForm = function() {
            self.loading = false;
            self.newMessage = {
                body: ""
            };
        };

        function extract(result) {
            console.log(result.data);
            //if (result.status === 201) {
            //    self.todos[self.todos.length - 1].id = result.data;
            //}
            return result.data;
        }

        function displayConversations() {
            //console.log("Starting display conversations method for " + $scope.user._id);
            $http.get("/api/conversations").then(function(result) {
                console.log(result);
                $scope.userConversations = result.data;
            });
        }

        function reloadData() {
            console.log($scope.activeChatUser);
            $http.get("/api/user").then(function(userResult) {
                $scope.loggedIn = true;
                $scope.user = userResult.data;
                $http.get("/api/users").then(function(result) {
                    $scope.users = result.data;
                    $scope.users = $scope.users.filter(function(item) {
                        if ($scope.user._id !== item.id) {
                            return item;
                        }
                    });
                    displayConversations();
                    if($scope.activeChatUser !== null && $scope.activeChatUser !== undefined) {
                        console.log("Updating the display message " + $scope.activeChatUser);
                        self.displayMessages($scope.activeChatUser);
                    }
                });
            }, function() {
                $http.get("/api/oauth/uri").then(function(result) {
                    $scope.loginUri = result.data.uri;
                });
            });
        }

        $http.get("/api/user").then(function(userResult) {
            $scope.loggedIn = true;
            $scope.user = userResult.data;
            $http.get("/api/users").then(function(result) {
                $scope.users = result.data;
                $scope.users = $scope.users.filter(function(item) {
                    if ($scope.user._id !== item.id) {
                        return item;
                    }
                });
                displayConversations();
            });
        }, function() {
            $http.get("/api/oauth/uri").then(function(result) {
                $scope.loginUri = result.data.uri;
            });
        });

        //self.displayConversations = function() {
        //    console.log("Starting display conversations method for " + $scope.user._id);
        //    $http.get("/api/conversations").then(function(result) {
        //        console.log(result);
        //        $scope.userConversations = result.data;
        //    });
        //};

        self.displayMessages = function(user) {
            console.log("Sending message to " + user.id);
            $scope.activeChatUser = user;
            console.log("Active Chat User " + $scope.activeChatUser);
            var messageTo = user.id;
            var placeholderMessage = {
                    seen: true
                };
            self.sendingMessage = angular.copy(user);
            self.isSendingMessage = true;
            $http.get("/api/user").then(function(userResult) {
                console.log($scope.user._id);
                console.log("Entering put field with " + placeholderMessage.seen);
                $http.put("/api/conversations/" + messageTo, placeholderMessage).then(function(result) {
                    console.log("result of update");
                    console.log(result);
                });
                $http.get("/api/conversations/" + messageTo).then(function(result) {
                    console.log("result");
                    console.log(result);
                    $scope.conversations = result.data;
                });
            }, function() {
                $http.get("/api/oauth/uri").then(function(result) {
                    $scope.loginUri = result.data.uri;
                });
            });
        };

        self.setSentMessage = function (user) {
            console.log("Sending message to " + user.id);
            self.sendingMessage = angular.copy(user);
            self.isSendingMessage = true;
        };

        self.sendMessage = function (user, message, isValid) {
            if (isValid) {
                self.loading = true;
                message.sent = Math.floor(Date.now());
                console.log(message);
                $http.post("/api/conversations/" + user.id, message)
                    .then(function(response) {
                        extract(response);
                        $scope.conversations = self.displayMessages(user);
                        self.resetForm();
                    })
                    .catch(function(error) {
                        self.error = "Failed to create message. Server returned " +
                            error.status + " - " + error.statusText;
                    });
            }
        };

        self.displayGroups = function() {
            $http.get("/api/groups")
                .then(function(response) {
                    $scope.groups = extract(response);
                })
                .catch(function(error) {
                    self.error = "Failed to get groups. Server returned " +
                            error.status + " - " + error.statusText;
                })
        };

        self.displayGroupDetails = function() {
            $http.get("/api/groups/" + "first-group")
                .then(function(response) {
                    $scope.groups = extract(response);
                })
                .catch(function(error) {
                    self.error = "Failed to get group. Server returned " +
                        error.status + " - " + error.statusText;
                })
        };

        self.createGroup = function() {
            var groupObject = new Object();
            groupObject.title = "Test title";
            console.log(groupObject);
            $http.put("/api/groups/" + "first-group", groupObject)
                .then(function(response) {
                    extract(response);
                })
                .catch(function(error) {
                    self.error = "Failed to create group. Server returned " +
                            error.status + " - " + error.statusText;
                });
        };

        self.removeGroup = function() {
            $http.delete("/api/groups/" + "first-group");
        };

        self.addUserToGroup = function() {
            console.log("Adding user to group");
            $http.put("/api/groups/" + "first-group" + "/users/" + "jackarnstein")
                .then(function(response) {
                    extract(response);
                })
                .catch(function(error) {
                    self.error = "Failed to create group. Server returned " +
                        error.status + " - " + error.statusText;
                });
        };

        self.getGroupUsers = function() {
            $http.get("api/" + "first-group" + "/users")
                .then(function(response) {
                    extract(response);
                })
                .catch(function(error) {
                    self.error = "Failed to get users of the group. Server returned " +
                            error.status + " - " + error.statusText;
                })
        }
    });
    app.filter("searchFor", function() {
        return function(arr, searchString) {
            if (!searchString) {
                return arr;
            }

            var result = [];

            searchString = searchString.toLowerCase();

            angular.forEach(arr, function(item) {
                //console.log(item); NEED TO CHANGE TO NAME, NOT ID.lowercase
                if (item.id.toLowerCase().indexOf(searchString) !== -1) {
                    result.push(item);
                }
            });
            return result;
        };
    });
})();
