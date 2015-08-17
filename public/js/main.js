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
            });
        }, function() {
            $http.get("/api/oauth/uri").then(function(result) {
                $scope.loginUri = result.data.uri;
            });
        });

        self.displayMessages = function(user) {
            console.log("Sending message to " + user.id);
            var messageTo = user.id;
            self.sendingMessage = angular.copy(user);
            self.isSendingMessage = true;
            $http.get("/api/user").then(function(userResult) {
                $scope.loggedIn = true;
                $scope.user = userResult.data;
                console.log(userResult.data._id);
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
