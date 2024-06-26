
var selectedModel = function(items) {
    return _.find(items, function(i) { return i.isSelected; });
}

function FieldsKeyboardHandler(fieldModels, questionsHandler) {
    var fields = fieldModels;
    var questionsHandler = questionsHandler;

    var delegateIfNoSelectedFieldTo = function(delegatedFunction) {
        if(!selectedModel(fields)) {
            return delegatedFunction();
        }
        return false;
    }

    // TODO add gotoNextQuestin and gotoPrevious question method in question handler and delegate to that?
    var switchActiveQuestions = function(currentQuestion, newQuestion) {
        if(currentQuestion != newQuestion) {

            // test the validator if we navigating forward
            if (questionsHandler.isAfterSelectedQuestion(newQuestion) && !currentQuestion.isValid()) {
                return false;
            }

            currentQuestion.toggleSelection();

            if(currentQuestion.parentSection != newQuestion.parentSection) {
                currentQuestion.parentSection.toggleSelection();
                newQuestion.parentSection.toggleSelection();
            }
            newQuestion.toggleSelection();
        }

        return true;
    };

    var switchActiveField = function(fieldIndexUpdater, showFirstFieldIfNoneIsActive) {
        var currentIndex;
        var newField = null;
        while (newField == null || newField.isDisabled()) {
            var field = selectedModel(fields);
            if(field) {
                if (field.onExit()) {   // call any exit handler, and only continue if it returns true
                    currentIndex = _.indexOf(fields, field);
                    var nextIndex = fieldIndexUpdater(currentIndex, fields);

                    //If we have reached the end of form, just cycle through fields on this section.
                    if (nextIndex == currentIndex && field.parentQuestion instanceof ConfirmationQuestionModel && field.parentQuestion.parentSection) {
                    	newField = field.parentQuestion.parentSection.questions[0].fields[0];
                    }
                    else {
                    	newField = fields[nextIndex];
                    }

                    if(newField) {
                        field.toggleSelection();
                        if(switchActiveQuestions(field.parentQuestion, newField.parentQuestion)) {
                            newField.toggleSelection();
                        }
                        else {
                            field.toggleSelection(); // kind of hacky, but we toggle the field back on if switching the question failed for some reason
                        }
                    } else {
                        return true;
                    }
                } else {
                    return false;
                }
            } else {
                if(showFirstFieldIfNoneIsActive) {
                    questionsHandler.selectedQuestion() || questionsHandler.nextQuestion();
                    if (questionsHandler.selectedQuestion() && questionsHandler.selectedQuestion().fields && questionsHandler.selectedQuestion().fields.length > 0) {
                      questionsHandler.selectedQuestion().fields[0].toggleSelection();
                    }
                    return true;
                }
            }
        }

        return newField != null;
    };

    // TODO ideally I think these api methods would be renamed based on function, not key and this would become "FieldHandler?"
    var api = {};
    api.handleUpKey = function() {
        return delegateIfNoSelectedFieldTo(questionsHandler.prevQuestion);
    };
    api.handleDownKey = function() {
        return delegateIfNoSelectedFieldTo(questionsHandler.nextQuestion);
    };
    api.handleTabKey = function() {
        var currentField = selectedModel(fields);
        var isValid = (currentField ? currentField.isValid() : true);
        var activeFieldSwitched = (isValid ? switchActiveField(findNextEnabledElement, true) : false);
        if (!activeFieldSwitched) { currentField.select(); }
        return true;
    };
    api.handleShiftTabKey = function() {
        return switchActiveField(findPreviousEnabledElement, false);
    };
    api.handleEnterKey = function() {
        var currentField = selectedModel(fields);
        var fieldType = currentField.element.attr("type");
        if(fieldType && fieldType.match(/submit|button/)) {
            currentField.element.click();
            return true;
        }
        else if (currentField.element.is('textarea')) {
            // don't prevent default behaviour when within a text area
            return false;
        }
        else {
            return api.handleTabKey();
        }
    };
    api.handleEscKey = function() {
        var field = selectedModel(fields);
        if(field) {
            field.toggleSelection();
            return true;
        }
        return false;
    };
    return api;
}

function QuestionsHandler(questionModels, prevButton) {
    var questions = questionModels;
    var prevButton = prevButton;

    var api = {};

    api.isAfterSelectedQuestion = function(newQuestion) {
        return (_.indexOf(questions, selectedModel(questions)) < _.indexOf(questions, newQuestion) ) ? true : false;
    };
    api.selectedQuestion = function() {
        return selectedModel(questions);
    };
    api.prevQuestion = function() {
        var question = selectedModel(questions);
        if(question) {
            if (!question.onExit()) {   // run any exit handler, and don't proceed if it returns false
                return true;
            }
            var idx = _.indexOf(questions, question);
            if(idx > 0) {
                var previousIdx = findPreviousEnabledElement(idx, questions);
                if (idx != previousIdx) {
                    // if there are no enabled elements before this one, hide previous button
                    if (previousIdx == findPreviousEnabledElement(previousIdx, questions)) {
                      prevButton.hide();
                    }
                    question.toggleSelection();
                    questions[previousIdx].toggleSelection();
                    if(question.parentSection != questions[previousIdx].parentSection) {
                        question.parentSection.toggleSelection();
                        questions[previousIdx].parentSection.toggleSelection();
                    }
                }
                return true;
            }
        }
        return false;
    };
    api.nextQuestion = function() {
        var question = selectedModel(questions);
        if(!question) {
            questions[0].toggleSelection();
            questions[0].parentSection.toggleSelection();
            return true;
        }

        if(!question.isValid() || !question.onExit()) {   // run the validation, if it passes, run the exit handlers; if either returns false, don't proceed
            return true;
        }
        var idx = _.indexOf(questions, question);
        if(idx < questions.length-1) {
            var nextIdx = findNextEnabledElement(idx, questions);

            if (idx != nextIdx) {
                prevButton.show();
                question.toggleSelection();
                questions[nextIdx].toggleSelection();
                if(question.parentSection != questions[nextIdx].parentSection) {
                    question.parentSection.toggleSelection();
                    questions[nextIdx].parentSection.toggleSelection();
                }
            }
            return true;
        }
        return false;
    };
    return api;
}

// the following functions bind "click" functions to the sections, questions and fields
var sectionsMouseHandlerInitializer = function(sections) {
    _.each(sections, function(section) {
        section.title.click( function(event) {
            clickedSectionHandler(sections, section, event);
        });
    });
};
var clickedSectionHandler = function(sections, section, event) {
    event.stopPropagation();
    var currentSection = selectedModel(sections);
    if(currentSection == section) {
        return;
    }

    var currentSectionIndex = _.indexOf(sections, currentSection);
    var clickedSectionIndex = _.indexOf(sections, section);
    var shouldSelectClickedSection = true;
    var goToSectionInstead = null;
    if(clickedSectionIndex > currentSectionIndex) {
        // only need to call validation if moving ahead
        for(var i=currentSectionIndex; i<clickedSectionIndex; i++) {
            shouldSelectClickedSection = sections[i].isValid() && shouldSelectClickedSection;
            if (!shouldSelectClickedSection) {
                if ((i >= currentSectionIndex) ) {
                    goToSectionInstead = sections[i];
                }
                break;
            }
        }
    }

    // call exit handler no matter if we are moving forward or backwards
    var exitCurrentSection = (shouldSelectClickedSection || goToSectionInstead) && currentSection.onExit();
    if (!exitCurrentSection) {
        shouldSelectClickedSection = false;
        goToSectionInstead = false;
    }

    if(!shouldSelectClickedSection) {
        if (goToSectionInstead) {
            currentSection.toggleSelection();
            goToSectionInstead.toggleSelection();
            var goToQuestion = goToSectionInstead.firstInvalidQuestion() || goToSectionInstead.questions[0];
            var goToField = goToQuestion.firstInvalidField() || goToQuestion.fields[0];
            goToQuestion.toggleSelection();
            goToField.toggleSelection();
            goToField.isValid();
        } else {
            var selectedQuestion = selectedModel(currentSection.questions);
            var selectedField = selectedModel(selectedQuestion.fields);
            selectedField && selectedField.select();
        }
    } else {
        currentSection.toggleSelection();
        section.toggleSelection();
        section.questions[0].toggleSelection();
        section.questions[0].fields[0].toggleSelection();
    }
};

var questionsMouseHandlerInitializer = function(questions) {
    _.each(questions, function(question) {
        if(question.questionLi) {
            question.questionLi.click(function(event) {
                clickedQuestionHandler(questions, question, event);
            });
        }
    });
};
var clickedQuestionHandler = function(questions, question, event) {
    event.stopPropagation();
    var currentQuestion = selectedModel(questions);
    if(currentQuestion == question) {
        return;
    }

    var currentQuestionIndex = _.indexOf(questions, currentQuestion);
    var clickedQuestionIndex = _.indexOf(questions, question);
    var shouldSelectClickedQuestion = true;
    var firstInvalidQuestion = null;
    if(clickedQuestionIndex > currentQuestionIndex) {
        for(var i=currentQuestionIndex; i<clickedQuestionIndex; i++) {
            if ( !questions[i].isValid() ) {
              firstInvalidQuestion = questions[i];
            }
            shouldSelectClickedQuestion = questions[i].isValid() && shouldSelectClickedQuestion;
            if (!shouldSelectClickedQuestion && firstInvalidQuestion) {
                // no point on checking if other questions are invalid, need to navigate back to the first invalid question
                break;
            }
        }
    }

    // call exit handler if validation has passed
    shouldSelectClickedQuestion = shouldSelectClickedQuestion && currentQuestion.onExit();

    if(!shouldSelectClickedQuestion) {
        if ( !currentQuestion.isValid() || !currentQuestion.onExit()) {
          // stay on the current question if it is invalid
          var selectedField = selectedModel(currentQuestion.fields);
          selectedField && selectedField.select();
        } else if ( firstInvalidQuestion != null ){
            // navigate forward to the first invalid question
          currentQuestion.toggleSelection();
          firstInvalidQuestion.toggleSelection();
          var goToField = firstInvalidQuestion.firstInvalidField() || firstInvalidQuestion.fields[0];
          goToField.toggleSelection();
          goToField.isValid();
          if(currentQuestion.parentSection != firstInvalidQuestion.parentSection) {
            currentQuestion.parentSection.toggleSelection();
            firstInvalidQuestion.parentSection.toggleSelection();
          }
        }
    } else {
        currentQuestion.toggleSelection();
        question.toggleSelection();
        question.fields[0].toggleSelection();
        if(currentQuestion.parentSection != question.parentSection) {
            currentQuestion.parentSection.toggleSelection();
            question.parentSection.toggleSelection();
        }
    }
};

var fieldsMouseHandlerInitializer = function(fields) {
    _.each(fields, function(field) {
        field.element.mousedown(function(event) {
            clickedFieldHandler(fields, field, event);
        });
    });
};

var clickedFieldHandler = function(fields, field, event) {
    var currentField = selectedModel(fields);
    if(currentField == field) {
        currentField.select();
        return;
    }

    var currentFieldIndex = _.indexOf(fields, currentField);
    var clickedFieldIndex = _.indexOf(fields, field);
    var shouldSelectClickedField = true;
    if(clickedFieldIndex > currentFieldIndex) {
        var startIndex = currentFieldIndex == -1 ? 0 : currentFieldIndex;
        for(var i=startIndex; i < clickedFieldIndex; i++) {
            shouldSelectClickedField = fields[i].isValid() && shouldSelectClickedField;
        }
    }

    // call exit handler if validation has passed
    if (currentField) {
      shouldSelectClickedField = shouldSelectClickedField && currentField.onExit();
    }

    if(!shouldSelectClickedField) {
        currentField && currentField.select();
    } else {
        currentField && currentField.toggleSelection();
        field.toggleSelection();
    }
    event.preventDefault();
};

var findNextEnabledElement = function (i, elements) {
    var nextEnabledElement = i + 1;
    while (nextEnabledElement < elements.length && elements[nextEnabledElement].isDisabled()) { nextEnabledElement++; }
    return nextEnabledElement != elements.length ? nextEnabledElement : i;  // if we reached the end without finding an enabled element, just return the passed-in index
}

var findPreviousEnabledElement = function (i, elements) {
    var previousEnabledElement = i - 1;
    while (previousEnabledElement >= 0 && elements[previousEnabledElement].isDisabled()) { previousEnabledElement--; }
    return previousEnabledElement != -1 ? previousEnabledElement : i;  // if we reached the end without finding an enabled element, just return the passed-in index
}
