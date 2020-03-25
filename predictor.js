const Days = {
    SUN:  0,
    MON1: 1,
    MON2: 2,
    TUE1: 3,
    TUE2: 4,
    WED1: 5,
    WED2: 6,
    THU1: 7,
    THU2: 8,
    FRI1: 9,
    FRI2: 10,
    SAT1: 11,
    SAT2: 12,
    length: 13,
};

const Method = {
    PRICE:       0, // 단순 가격
    SP:          1, // 구매가 * x%
    PRICE_DIFF:  2, // 이전 가격 + x (벨)
    SP_DIFF:     3, // TODO: ?
    PRICE_RATIO: 4, // 이전 가격 * x (%)
}

const WavePatternTransitionType = {
    RISING:              'R',
    TWO_TIMES_FALLING:   '2',
    THREE_TIMES_FALLING: '3',
};

class PredictionRange {
    constructor(min, max) {
        this.min = this.roundMinMethod(min - this.tolerance);
        this.max = this.roundMaxMethod(max + this.tolerance);
    }

    toString() {
        if (this.min == this.max) {
            return this.min;
        }
        return this.min + '~' + this.max;
    }
}

class Transition {
    constructor(method, min, max) {
        this.method = method;
        this.min = min;
        this.max = max;
    }
}

function predict(parameters, prices) {
    PredictionRange.prototype.roundMinMethod = parameters.roundMinMethod;
    PredictionRange.prototype.roundMaxMethod = parameters.roundMaxMethod;
    PredictionRange.prototype.tolerance = parameters.tolerance;

    return {
        wave: predictWavePattern(parameters.wave, prices),
        falling: predictFallingPattern(parameters.falling, prices),
        thirdPeriod: predictThirdPeriodPattern(parameters.thirdPeriod, prices),
        fourthPeriod: predictFourthPeriodPattern(parameters.fourthPeriod, prices),
    };
}

function predictWavePattern(parameters, prices) {
    const predictions = new Map();

    for (let twoTimesFallingStartDay of parameters.twoTimesFallingStartDays) {
        for (let threeTimesFallingStartDay of parameters.threeTimesFallingStartDays) {
            const minMargin = 1;
            if (twoTimesFallingStartDay <= threeTimesFallingStartDay
                    && twoTimesFallingStartDay + 2 + minMargin > threeTimesFallingStartDay) {
                continue;
            } else if (threeTimesFallingStartDay < twoTimesFallingStartDay
                    && threeTimesFallingStartDay + 3 + minMargin > twoTimesFallingStartDay) {
                continue;
            }

            // Load parameters
            const getTransitionFromDay = function(day) {
                switch (day) {
                    case twoTimesFallingStartDay + 0:
                        return parameters.twoTimesFalling1Transition;
                    case twoTimesFallingStartDay + 1:
                        return parameters.twoTimesFalling2Transition;
                    case threeTimesFallingStartDay + 0:
                        return parameters.threeTimesFalling1Transition;
                    case threeTimesFallingStartDay + 1:
                        return parameters.threeTimesFalling2Transition;
                    case threeTimesFallingStartDay + 2:
                        return parameters.threeTimesFalling3Transition;
                    default:
                        return parameters.risingTransition;
                }
            }
            const getTypeFromDay = function(day) {
                switch(day) {
                    case twoTimesFallingStartDay + 0:
                    case twoTimesFallingStartDay + 1:
                        return WavePatternTransitionType.TWO_TIMES_FALLING;
                    case threeTimesFallingStartDay + 0:
                    case threeTimesFallingStartDay + 1:
                    case threeTimesFallingStartDay + 2:
                        return WavePatternTransitionType.THREE_TIMES_FALLING;
                    default:
                        return WavePatternTransitionType.RISING;
                }
            }
            const transitions = new Array(Days.length);
            let key = '';
            for (let i = Days.MON1; i < Days.length; i++){
                transitions[i] = getTransitionFromDay(i);
                key += getTypeFromDay(i);
            }

            // Predict
            predictions.set(key, calcPrediction(prices, transitions));
        }
    }

    return predictions;
}

function predictFallingPattern(parameters, prices) {
    // Load parameters
    const transitions = new Array(Days.length);
    transitions[Days.MON1] = parameters.mon1Transition;
    transitions.fill(parameters.otherDaysTransition, Days.MON2);

    // Predict
    return calcPrediction(prices, transitions);
}

function predictThirdPeriodPattern(parameters, prices) {
    const predictions = new Array(Days.length);

	for (let risingStartDay of parameters.risingStartDays) {
        // Load parameters
        const transitions = new Array(Days.length);
        transitions[Days.MON1] = parameters.mon1Transition;
        transitions.fill(parameters.beforeRisingTransition, Days.MON2, risingStartDay);
        const risingTransitionSequence = [
            parameters.rising1Transition,
            parameters.rising2Transition,
            parameters.rising3Transition,
            parameters.rising4Transition,
            parameters.rising5Transition,
            parameters.rising6Transition,
        ];
        for (let i = risingStartDay; i < Days.length; i++) {
            let offset = i - risingStartDay;
            if (offset < risingTransitionSequence.length) {
                transitions[i] = risingTransitionSequence[offset];
            } else {
                transitions[i] = parameters.afterRisingTransition;
            }
        }

        // Predict
        predictions[risingStartDay] = calcPrediction(prices, transitions);
	}

    return predictions;
}

function predictFourthPeriodPattern(parameters, prices) {
    const predictions = predictThirdPeriodPattern(parameters, prices);

    if (!parameters.hasFourthPeriodPeak) {
        return predictions;
    }

    // Make fouth period peak
    for (let risingStartDay of parameters.risingStartDays) {
        const prediction = predictions[risingStartDay];
        if (!prediction) {
            continue;
        }

        if (prices[risingStartDay + 3]) {
            if (!prices[risingStartDay + 2]) {
                prediction[risingStartDay + 2].max = Math.min(
                        prediction[risingStartDay + 2].max,
                        prices[risingStartDay + 3]);
            }
            if (prices[risingStartDay + 4]) {
                prediction[risingStartDay + 4].max = Math.min(
                        prediction[risingStartDay + 4].max,
                        prices[risingStartDay + 3]);
            }
        } else {
            if (prices[risingStartDay + 2]) {
                prediction[risingStartDay + 3].min = Math.max(
                        prediction[risingStartDay + 3].min,
                        prices[risingStartDay + 2]);
            }
            if (prices[risingStartDay + 4]) {
                prediction[risingStartDay + 3].min = Math.max(
                        prediction[risingStartDay + 3].min,
                        prices[risingStartDay + 4]);
            }
        }
    }

    return predictions;
}

function calcPrediction(prices, transitions) {
    const purchasePriceMinMax = getPurchacePriceMinMax(prices[Days.SUN]);
    const prediction = new Array(Days.length);
    prediction[Days.SUN] = new PredictionRange(
        purchasePriceMinMax[0],
        purchasePriceMinMax[1],
    );
    const pricesCopy = [...prices];

    for (let purchasePrice of purchasePriceMinMax) {
        pricesCopy[Days.SUN] = purchasePrice;
        const eachPrediction = calcEachPrediction(pricesCopy, transitions);
        if (!eachPrediction) {
            continue;
        }

        for (let i = Days.MON1; i < Days.length; i++) {
            if (!prediction[i]) {
                prediction[i] = eachPrediction[i];
            } else {
                prediction[i].min = Math.min(prediction[i].min, eachPrediction[i].min);
                prediction[i].max = Math.max(prediction[i].max, eachPrediction[i].max);
            }
        }
    }

    for (let i = Days.MON1; i < Days.length; i++) {
        if (prices[i]) {
            prediction[i] = new PredictionRange(prices[i], prices[i]);
        } else if (!prediction[i]){
            return null;
        }
    }

    return prediction;
}

// TODO: refactoring
function calcEachPrediction(prices, transitions) {
    let prediction = new Array(Days.length);

    // Forward prediction
    for (let i = Days.MON1; i < Days.length; i++) {
        switch (transitions[i].method) {
            case Method.PRICE:
                prediction[i] = new PredictionRange(
                    transitions[i].min,
                    transitions[i].max,
                );
                break;

            case Method.SP:
                prediction[i] = new PredictionRange(
                    prices[Days.SUN] * transitions[i].min / 100,
                    prices[Days.SUN] * transitions[i].max / 100,
                );
                break;

            case Method.PRICE_DIFF:
                if (prices[i - 1]) {
                    prediction[i] = new PredictionRange(
                        prices[i - 1] + transitions[i].min,
                        prices[i - 1] + transitions[i].max,
                    );
                } else {
                    prediction[i] = new PredictionRange(
                        prediction[i - 1].min + transitions[i].min,
                        prediction[i - 1].max + transitions[i].max,
                    );
                }
                break;

            // 이전가 + 구매가 * 퍼센트?
            case Method.SP_DIFF:
                var spMin = 0;
                var spMax = 0;
                for(var j = i; j >= Days.MON1; j--) {
                    if (prices[j] && j != i) {
                        prediction[i] = new PredictionRange(
                            prices[j] + (prices[Days.SUN] * spMin / 100),
                            prices[j] + (prices[Days.SUN] * spMax / 100),
                        );
                        break;
                    } else if (transitions[j].method == Method.PRICE || transitions[j].method == Method.PRICE_DIFF || transitions[j].method == Method.PRICE_RATIO) {
                        prediction[i] = new PredictionRange(
                            prediction[j].min + prices[Days.SUN] * spMin / 100,
                            prediction[j].max + prices[Days.SUN] * spMax / 100,
                        );
                        break;
                    } else if (transitions[j].method == Method.SP) {
                        spMin += transitions[j].min;
                        spMax += transitions[j].max;
                        prediction[i] = new PredictionRange(
                            prices[Days.SUN] * spMin / 100,
                            prices[Days.SUN] * spMax / 100,
                        );
                        break;
                    } else if (transitions[j].method == Method.SP_DIFF) {
                        spMin += transitions[j].min;
                        spMax += transitions[j].max;
                        if (j == Days.MON1) {
                            spMin += 100;
                            spMax += 100;
                            prediction[i] = new PredictionRange(
                                 prices[Days.SUN] * spMin / 100 ,
                                 prices[Days.SUN] * spMax / 100 ,
                            );
                            break;
                        }
                        continue;
                    } else {
                        prediction[i] = undefined;
                        break;
                    }
                }
                break;

            case Method.PRICE_RATIO:
                if (prices[i - 1]) {
                    prediction[i] = new PredictionRange(
                         prices[i - 1] * transitions[i].min / 100,
                         prices[i - 1] * transitions[i].max / 100,
                    );
                } else {
                    prediction[i] = new PredictionRange(
                         prediction[i - 1].min * transitions[i].min / 100,
                         prediction[i - 1].max * transitions[i].max / 100,
                    );
                }
                break;
        }
    }

    // Backward prediction
    for(let i = Days.length - 1; i >= Days.MON2; i--){
        let backwardPrediction;

        switch (transitions[i].method){
            case Method.PRICE_DIFF:
                if (prices[i]){
                    backwardPrediction = new PredictionRange(
                        prices[i] - transitions[i].max,
                        prices[i] - transitions[i].min,
                    );
                } else {
                    backwardPrediction = new PredictionRange(
                        prediction[i].min - transitions[i].max,
                        prediction[i].max - transitions[i].min,
                    );
                }
                break;

            case Method.SP_DIFF:
                var spMin = 0;
                var spMax = 0;
                for (var j=i;j<=Days.SAT2;j++){
                    if (transitions[j].method == Method.PRICE || transitions[j].method == Method.SP) {
                        break;
                    } else if (transitions[j].method == Method.PRICE_DIFF || transitions[j].method == Method.PRICE_RATIO) {
                        if (prices[j - 1]) {
                            backwardPrediction = new PredictionRange(
                                 prices[j - 1] - prices[Days.SUN] * spMax / 100,
                                 prices[j - 1] - prices[Days.SUN] * spMin / 100,
                            );
                            break;
                        } else {
                            backwardPrediction = new PredictionRange(
                                 prediction[j - 1].min - prices[Days.SUN] * spMax / 100 ,
                                 prediction[j - 1].max - prices[Days.SUN] * spMin / 100 ,
                            );
                            break;
                        }
                    } else if (transitions[j].method == Method.SP_DIFF) {
                        spMin += transitions[j].min;
                        spMax += transitions[j].max;
                        if (prices[j]) {
                            backwardPrediction = new PredictionRange(
                                prices[j] - prices[Days.SUN] * spMax / 100,
                                prices[j] - prices[Days.SUN] * spMin / 100,
                            );
                            break;
                        } else {
                            continue;
                        }
                    } else {
                        break;
                    }
                }
                break;

            case Method.PRICE_RATIO:
                if (prices[i]) {
                    backwardPrediction = new PredictionRange(
                        prices[i] * 100 / transitions[i].max,
                        prices[i] * 100 / transitions[i].min,
                    );
                } else {
                    backwardPrediction = new PredictionRange(
                        prediction[i].min * 100 / transitions[i].max,
                        prediction[i].max * 100 / transitions[i].min,
                    );
                }
                break;
        }

        if (backwardPrediction) {
            if (!prediction[i - 1]) {
                prediction[i - 1] = new PredictionRange(backwardPrediction.min, backwardPrediction.max);
            } else {
                prediction[i - 1].min = Math.min(prediction[i - 1].min, backwardPrediction.min);
                prediction[i - 1].max = Math.max(prediction[i - 1].max, backwardPrediction.max);
            }
        }
    }

    for (let i = Days.MON1; i < Days.length; i++) {
        if (!prices[i] || !prediction[i]) {
            continue;
        }

        if (!isPredictionAcceptable(prediction[i], prices[i])) {
            return null;
        }
    }

    return prediction;
}

function getPurchacePriceMinMax(price) {
    const min = 90;
    const max = 110;

    if (price && min <= price && price <= max) {
        return [price, price];
    }
    return [min, max];
}

function isPredictionAcceptable(prediction, realValue) {
    return prediction.min <= realValue && realValue <= prediction.max;
}
