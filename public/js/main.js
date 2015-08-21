(function() {
    var app = angular.module("ChatApp", []);

    app.controller("ChatController", function($scope, $http, $rootScope) {
        var self = this;
        $scope.loggedIn = false;
        $scope.showModal = false;
        $scope.showAddUsersModal = false;
        $scope.activeChatUser = "";
        $scope.activeChatGroup = "";
        $scope.tempUser = [];
        $scope.groupUsers = [];

        self.resetForm = function() {
            self.loading = false;
            self.newMessage = {
                body: ""
            };
        };

        function extract(result) {
            console.log(result.data);
            return result.data;
        }

        function displayConversations() {
            $http.get("/api/conversations").then(function(result) {
                console.log(result);
                $scope.userConversations = result.data;
            });
        }

        function displayGroups() {
            $http.get("/api/groups")
                .then(function(response) {
                    $scope.groups = extract(response);
                })
                .catch(function(error) {
                    self.error = "Failed to get groups. Server returned " +
                        error.status + " - " + error.statusText;
                })
        }

        function updateRemoveUsers(item) {
            console.log(item);
            if (!item.id) {
                $scope.addGroupUsers = $scope.addGroupUsers.filter(function (user) {
                    if (user.id !== item) {
                        return user;
                    }
                });
            } else {
                $scope.addGroupUsers = $scope.addGroupUsers.filter(function (user) {
                    if (user.id !== item.id) {
                        return user;
                    }
                });
            }
        }

        function updateAddUser(item){
            $scope.addGroupUsers.push(item);
        }

        function reloadData() {
            $http.get("/api/user").then(function(userResult) {
                $scope.loggedIn = true;
                $scope.user = userResult.data;
                $http.get("/api/users").then(function(result) {
                    $scope.users = result.data;
                    $scope.addGroupUsers = $scope.users;
                    $scope.users = $scope.users.filter(function(item) {
                        if ($scope.user._id !== item.id) {
                            return item;
                        }
                    });
                    displayConversations();
                    displayGroups();
                    if($scope.activeChatUser !== null && $scope.activeChatUser !== undefined) {
                        self.displayMessages($scope.activeChatUser);
                    } else if($scope.activeChatGroup !== null && $scope.activeChatGroup !== undefined) {
                        self.displayMessages($scope.activeChatGroup);
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
                $scope.addGroupUsers = $scope.users;
                $scope.users = $scope.users.filter(function(item) {
                    if ($scope.user._id !== item.id) {
                        return item;
                    }
                });
                displayConversations();
                displayGroups();
            });
        }, function() {
            $http.get("/api/oauth/uri").then(function(result) {
                $scope.loginUri = result.data.uri;
            });
        });

        self.displayMessages = function(user) {
            $scope.activeChatUser = user;
            var messageTo = user.id;
            var placeholderMessage = {
                    seen: true
                };
            self.sendingMessage = angular.copy(user);
            self.isSendingMessage = true;
            self.isSendingGroupMessage = false;
            $http.get("/api/user").then(function(userResult) {
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

        self.displayGroupMessages = function(group) {
            console.log("Sending message to " + group.id);
            $scope.groupUsers = [];
            $scope.activeChatGroup = group;
            self.getGroupUsers(group);
            console.log("Active Chat Group " + $scope.activeChatGroup);
            var messageTo = group.id;
            var placeholderMessage = {
                seen: true
            };
            self.sendingMessage = angular.copy(group);
            self.isSendingGroupMessage = true;
            self.isSendingMessage = false;
            console.log($scope.user._id);
            console.log("Entering put field with " + placeholderMessage.seen);
            $http.put("/api/groups/conversations/" + messageTo, placeholderMessage).then(function(result) {
                console.log("result of update");
                console.log(result);
            });
            $http.get("/api/groups/conversations/" + messageTo).then(function(result) {
                console.log("result");
                console.log(result);
                $scope.conversations = result.data;
            });
        };

        self.setSentMessage = function (user) {
            console.log("Sending message to " + user.id);
            self.sendingMessage = angular.copy(user);
            self.isSendingMessage = true;
        };

        socket.on("update", function(user,from, msg) {
            console.log("To:");
            console.log(user);
            console.log("From:");
            console.log(from);
            console.log("Received message: ");
            console.log(msg);
            if (from._id === $scope.user._id || user.id === $scope.user._id) {
                $rootScope.$apply(function() {
                    $scope.conversations.unshift(msg);
                });
            }
        });

        socket.on("group created", function(group) {
            console.log("Group created!");
            console.log(group);
        });

        socket.on("group create failed", function(group) {
            console.log("Group failed to create.");
            console.log(group);
        });

        self.sendMessage = function (user, message, isValid) {
            console.log(user);
            if (isValid) {
                self.loading = true;
                message.sent = Math.floor(Date.now());
                console.log(message);
                socket.emit("private message", user, $scope.user, message);
                self.resetForm();
            }
        };

        self.displayGroupDetails = function(group) {
            $http.get("/api/groups/" + group.id)
                .then(function(response) {
                    extract(response);
                })
                .catch(function(error) {
                    self.error = "Failed to get group. Server returned " +
                        error.status + " - " + error.statusText;
                })
        };

        self.createGroup = function(group, isValid) {
            if (isValid) {
                console.log(group);
                socket.emit("create group", group, $scope.user);
            }
        };

        self.removeGroup = function(group) {
            $http.delete("/api/groups/" + group.id);
        };

        self.addUserToGroup = function(group) {
            console.log("Adding user to group");
            $scope.tempUser.forEach(function(user) {
                $http.put("/api/groups/" + group.id + "/users/" + user.id)
                    .then(function(response) {
                        extract(response);
                        $scope.showAddUsersModal = false;
                    })
                    .catch(function(error) {
                        self.error = "Failed to create group. Server returned " +
                            error.status + " - " + error.statusText;
                    });
            });
            $scope.tempUser = [];
        };

        self.getGroupUsers = function(group) {
            console.log("Get group details for: " + group.id);
            console.log(group);
            $http.get("/api/groups/" + group.id + "/users")
                .then(function(response) {
                    var tempGroupsUsers = extract(response);
                    tempGroupsUsers.forEach(function(item) {
                        updateRemoveUsers(item);
                        $scope.groupUsers.push(item);
                    });
                    console.log("Group members: ");
                    console.log($scope.groupUsers);
                })
                .catch(function(error) {
                    self.error = "Failed to get users of the group. Server returned " +
                            error.status + " - " + error.statusText;
                })
        }

        self.removeGroupUser = function(group, groupUser) {
            console.log(group);
            console.log(groupUser);
            if (!groupUser._id) {
                $http.delete("/api/groups/" + group.id + "/users/" + groupUser)
                    .then(function (response) {
                        extract(response);
                        $scope.groupUsers = $scope.groupUsers.filter(function (item) {
                            if (item !== groupUser) {
                                return item;
                            }
                        });
                        $scope.addGroupUsers.push(groupUser);
                    })
                    .catch(function (error) {
                        self.error = "Failed to remove user from the group. Server returned " +
                            error.status + " - " + error.statusText;
                    })
            } else {
                $http.delete("/api/groups/" + group.id + "/users/" + groupUser._id)
                    .then(function (response) {
                        extract(response);
                        $scope.groupUsers = $scope.groupUsers.filter(function (item) {
                            if (item !== groupUser._id) {
                                return item;
                            }
                        });
                        $scope.addGroupUsers.push(groupUser);
                    })
                    .catch(function (error) {
                        self.error = "Failed to remove user from the group. Server returned " +
                            error.status + " - " + error.statusText;
                    })
            }
        };

        $scope.toggleModal = function() {
            $scope.showModal = !$scope.showModal;
        };

        $scope.toggleShowAddUsersModal = function() {
            $scope.showAddUsersModal = !$scope.showAddUsersModal;
        };

        self.addUserTemp = function(item) {
            console.log("Adding to tempUser");
            console.log(item);
            updateRemoveUsers(item);
            $scope.tempUser.push(item);
        };

        self.removeUserTemp = function(item) {
            console.log("Removing from tempUser");
            console.log(item);
            updateAddUser(item);
            $scope.tempUser = $scope.tempUser.filter(function(temp) {
                if (temp.id !== item.id) {
                    return temp;
                }
            })
        };
    });
    app.filter("searchFor", function() {
        return function(arr, searchString) {
            if (!searchString) {
                return arr;
            }

            var result = [];

            searchString = searchString.toLowerCase();

            angular.forEach(arr, function(item) {
                if (item.id.toLowerCase().indexOf(searchString) !== -1) {
                    result.push(item);
                }
            });
            return result;
        };
    });

    app.directive("modal", function() {
        return {
            template: '<div class="modal fade">' +
            '<div class="modal-dialog">' +
            '<div class="modal-content">' +
            '<div class="modal-header">' +
            '<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>' +
            '<h4 class="modal-title">{{ title }}</h4>' +
            '</div>' +
            '<div class="modal-body" ng-transclude></div>' +
            '</div>' +
            '</div>' +
            '</div>',
            restrict: 'E',
            transclude: true,
            replace:true,
            scope:true,
            link: function postLink(scope, element, attrs) {
                console.log(attrs.title);
                scope.title = attrs.title;

                scope.$watch(attrs.visible, function(value){
                    if(value == true)
                        $(element).modal('show');
                    else
                        $(element).modal('hide');
                });

                $(element).on('shown.bs.modal', function(){
                    scope.$apply(function(){
                        scope.$parent[attrs.visible] = true;
                    });
                });

                $(element).on('hidden.bs.modal', function(){
                    scope.$apply(function(){
                        scope.$parent[attrs.visible] = false;
                    });
                });
            }
        };
    })
})();
