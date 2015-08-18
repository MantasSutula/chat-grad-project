(function() {
    var app = angular.module("ChatApp", []);

    app.controller("ChatController", function($scope, $http) {
        var self = this;
        $scope.loggedIn = false;

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
            });
        }, function() {
            $http.get("/api/oauth/uri").then(function(result) {
                $scope.loginUri = result.data.uri;
            });
        });

        self.displayConversations = function() {
            console.log("Starting display conversations method for " + $scope.user._id);
            $http.get("/api/conversations").then(function(conversations) {
                console.log(conversations);
            });
        };

        self.displayMessages = function(user) {
            console.log("Sending message to " + user.id);
            var messageTo = user.id;
            var placeholderMessage = {
                    seen: true
                };
            self.sendingMessage = angular.copy(user);
            self.isSendingMessage = true;
            $http.get("/api/user").then(function(userResult) {
                $scope.loggedIn = true;
                $scope.user = userResult.data;
                console.log($scope.user.data._id);
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
    });
    //app.filter("orderObjectBy", function() {
    //    return function(items, field, reverse) {
    //        var filtered = [];
    //        angular.forEach(items, function(item) {
    //            filtered.push(item);
    //        });
    //        filtered.sort(function (a, b) {
    //            return (a[field] > b[field] ? 1 : -1);
    //        });
    //        if(reverse) filtered.reverse();
    //        return filtered;
    //    };
    //});
})();
