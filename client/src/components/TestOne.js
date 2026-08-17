import React, { useState, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../context/UserContext';
import Breadcrumb from './Breadcrumb';

const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

// We define the questions on the frontend as well
const testQuestions = [
    {
        id: "q1",
        text: "Which of the following scenarios best illustrates the concept of scarcity and the resulting need for economic choices?",
        options: {
            "a": "A family has more than enough water to meet all their needs.",
            "b": "A person is able to purchase any product they desire without considering the cost.",
            "c": "A factory can produce an unlimited number of bicycles with its current machinery.",
            "d": "A consumer has a fixed budget and must choose between buying a new video game or several new shirts."
        },
        answer: "d",
        learningGoal: "Understanding the characteristics of a scarce resource",
        optionFeedback: {
            "a": "This describes abundance, the opposite of scarcity.",
            "b": "This implies infinite resources, meaning scarcity does not exist for this individual.",
            "c": "This suggests unlimited capital and raw materials, which contradicts the principle that resources are finite.",
            "d": "Scarcity occurs when limited resources (money, in this case) meet unlimited wants. The need to make a \"choice\" or \"trade-off\" is the direct result of scarcity."
        },
        explanation: "Scarcity occurs when limited resources (money, in this case) meet unlimited wants. The need to make a \"choice\" or \"trade-off\" is the direct result of scarcity."
    },
    {
        id: "q2",
        text: "A rare element is discovered, and has important applications in healthcare. Its global supply is incredibly small and cannot be substantially increased. This situation best describes:",
        options: {
            "a": "A resource that experiences increasing demand.",
            "b": "A resource that is facing relative scarcity.",
            "c": "A resource that is subject to absolute scarcity.",
            "d": "A resource that has multiple alternative uses."
        },
        answer: "c",
        learningGoal: "Understand the difference between absolute and relative scarcity",
        optionFeedback: {
            "a": "This describes a market trend, not the nature of the resource's availability.",
            "b": "This refers to resources that are scarce compared to the demand for them but could potentially be replenished or substituted (like oil or timber).",
            "c": "Absolute scarcity occurs when the total quantity of a resource is naturally limited and cannot be increased, regardless of demand or price.",
            "d": "This describes the utility of the resource, not the nature of its scarcity."
        },
        explanation: "Absolute scarcity occurs when the total quantity of a resource is naturally limited and cannot be increased, regardless of demand or price."
    },
    {
        id: "q3",
        text: "A farmer uses water when growing his crops. Which factor of production can it be categorized as?",
        options: {
            "a": "Capital",
            "b": "Labor",
            "c": "Land",
            "d": "Entrepreneurship"
        },
        answer: "c",
        learningGoal: "Understanding the factors of production, and their applications",
        optionFeedback: {
            "a": "Refers to man-made tools, buildings, and machinery (e.g., the farmer's tractor).",
            "b": "Refers to the human effort and work put into the production process.",
            "c": "\"Land\" encompasses all natural resources used in production that are not man-made",
            "d": "Refers to the person who combines the other three factors to take risks and start a business."
        },
        explanation: "\"Land\" encompasses all natural resources used in production that are not man-made."
    },
    {
        id: "q4",
        text: "You have $30. Your friend invites you to go bowling with them. Although the experience itself costs $15, you value it at $35. You also have the option to go to dinner alone. The meal usually costs $40, but you can go for only $20. What is the opportunity cost of going to dinner?",
        options: {
            "a": "The $25 spent on dinner",
            "b": "The $15 cost of bowling",
            "c": "The $40 value of the dinner",
            "d": "The $35 value of going bowling with friends",
            "e": "The $5 difference between the value of dinner and bowling"
        },
        answer: "d",
        learningGoal: "Understanding what an opportunity cost is, and how to apply it",
        optionFeedback: {
            "a": "This is the explicit cost (accounting cost) of the dinner, not the opportunity cost.",
            "b": "This is the price of the alternative, but it doesn't represent the value you lose by not going.",
            "c": "This is the value of the choice you did make, not what you gave up.",
            "d": "Opportunity cost is the value of the next best alternative foregone. If you choose dinner, you give up the entire subjective value you placed on the bowling experience ($35).",
            "e": "This is the marginal benefit or \"net gain\" of one choice over the other, but opportunity cost focuses solely on what was sacrificed."
        },
        explanation: "Opportunity cost is the value of the next best alternative foregone. If you choose dinner, you give up the entire subjective value you placed on the bowling experience ($35)."
    },
    {
        id: "q5",
        text: "A small town decides to install new, bright streetlights along all its main roads. Once these streetlights are on, it's impossible to stop any resident or visitor from benefiting from the added light at night. Based on these features, the streetlight service is best described as",
        options: {
            "a": "public good, because the town had to pay for them",
            "b": "public good, because everyone benefits from the lights",
            "c": "private good, because only the people living in that specific town can use them",
            "d": "private good, because the lights are very expensive to install and maintain."
        },
        answer: "b",
        learningGoal: "Identify the difference between a public and private good",
        optionFeedback: {
            "a": "Payment does not determine whether a good is public; the key features are rivalry and excludability.",
            "b": "Streetlights are non-excludable and non-rival, meaning everyone can benefit without reducing others’ use.",
            "c": "Even if geographically limited, the lights are still non-excludable within that area, making them public goods.",
            "d": "High cost does not define a private good; the defining traits are non-rivalry and non-excludability."
        },
        explanation: "Streetlights are non-excludable and non-rival, meaning everyone can benefit without reducing others' use."
    },
    {
        id: "q6",
        text: "You decide to quit a job paying $50,000 a year to start a bookstore. This past year you had a total sales revenue of $200,000. Your direct expenses for books, rent, and employee salaries (explicit costs) amounted to $130,000. What is the bookstore's accounting profit for last year?",
        options: {
            "a": "$200,000",
            "b": "$330,000",
            "c": "$70,000",
            "d": "$130,000"
        },
        answer: "c",
        learningGoal: "Understand accounting vs economic profit",
        optionFeedback: {
            "a": "This is total revenue, not profit.",
            "b": "This incorrectly adds revenue and costs instead of subtracting them.",
            "c": "Accounting profit equals revenue minus explicit costs only.",
            "d": "This is the amount of explicit costs, not profit."
        },
        explanation: "Accounting profit equals revenue minus explicit costs only: $200,000 − $130,000 = $70,000."
    },
    {
        id: "q7",
        text: "If you consume pasta every day of the week, the marginal utility of pasta is likely to ________ at the end of the week, ceteris paribus, and this demonstrates the law of ________.",
        options: {
            "a": "decline; diminishing marginal utility",
            "b": "increase; increasing marginal utility",
            "c": "increase; diminishing marginal utility",
            "d": "decrease; total utility"
        },
        answer: "a",
        learningGoal: "understanding the types of utility",
        optionFeedback: {
            "a": "As you consume more pasta, the additional satisfaction from each extra serving decreases, demonstrating diminishing marginal utility.",
            "b": "Marginal utility typically decreases with repeated consumption of the same good.",
            "c": "Diminishing marginal utility means marginal utility falls, not rises.",
            "d": "Total utility may still increase overall, but the concept demonstrated here concerns marginal utility."
        },
        explanation: "As you consume more pasta, the additional satisfaction from each extra serving decreases, demonstrating diminishing marginal utility."
    },
    {
        id: "q8",
        text: "A student has already spent 4 hours studying for a Macroeconomics exam, and believes she will get an 82%. She calculates that studying for a 5th hour will increase her score to 88%, but she’d have to skip a cooking class that cost $25. Her average study time per exam this semester is 3 hours. To make a rational decision regarding that 5th hour, which of the following represents the correct marginal comparison?",
        options: {
            "a": "The 6% increase in the exam grade versus the $25 opportunity cost of the fitness class.",
            "b": "The 88% projected total grade versus the 4 hours of effort already invested.",
            "c": "The marginal gain of 6% versus the average utility of 3 hours of study time.",
            "d": "The total tuition cost per credit hour versus the potential increase in lifetime earnings from an 88% grade."
        },
        answer: "a",
        learningGoal: "explain how rational decisions are made by comparing marginal benefits",
        optionFeedback: {
            "a": "This identifies the marginal benefit (the specific change in utility/grade from the next unit of input) and weighs it against the marginal cost (the value of the next best alternative foregone).",
            "b": "This is a \"sunk cost\" fallacy. The 4 hours already spent cannot be recovered and should not influence the decision to study for the 5th hour.",
            "c": "Rational agents compare marginal benefits to marginal costs, not to historical averages or \"mean\" performance.",
            "d": "While these are economic factors, they are too broad to be considered \"marginal\" in the context of a single-hour study decision; they represent total or structural costs rather than the incremental trade-off at hand."
        },
        explanation: "This identifies the marginal benefit (the specific change in utility/grade from the next unit of input) and weighs it against the marginal cost (the value of the next best alternative foregone)."
    },
    {
        id: "q9",
        text: "You decide to leave your corporate job, where you earned $85,000 a year, to start your own independent software consultancy. In your first year, you brought in $210,000 in total revenue. Your business expenses (office rent, software licenses, and hardware) totaled $95,000. What is the consultancy's economic profit for the first year?",
        options: {
            "a": "$210,000",
            "b": "$115,000",
            "c": "$30,000",
            "d": "$180,000"
        },
        answer: "c",
        learningGoal: "Understand accounting vs economic profit",
        optionFeedback: {
            "a": "This is total revenue, not profit.",
            "b": "This is the accounting profit.",
            "c": "Economic profit subtracts both explicit costs ($95,000) and implicit costs ($85,000) from total revenue.",
            "d": "This incorrectly subtracts the implicit cost from the revenue but ignores the actual business expenses."
        },
        explanation: "Economic profit subtracts both explicit costs ($95,000) and implicit costs ($85,000) from total revenue."
    }
];

const TestOne = ({ testType, nextProgress }) => {
    const { user, setUser } = useContext(UserContext);
    const [answers, setAnswers] = useState({});
    const attentionCheckQuestion = {
        id: 'attention-check-pretest',
        text: 'What color is a dollar bill?',
        options: {
            a: 'Red',
            b: 'Orange',
            c: 'Green',
            d: 'Yellow'
        },
        answer: 'c',
        learningGoal: 'Confirm attention during the learning session',
        explanation: 'A dollar bill is green.'
    };

    const [randomizedQuestions] = useState(() => {
        const baseQuestions = shuffleArray(testQuestions);
        if (testType === 'pretest') {
            const mid = Math.floor(baseQuestions.length / 2);
            return [
                ...baseQuestions.slice(0, mid),
                attentionCheckQuestion,
                ...baseQuestions.slice(mid)
            ];
        }
        return baseQuestions;
    });

    const handleChange = (questionId, answer) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('/api/tests/submit', {
                participantId: user.participantId,
                testType,
                answers,
                questionOrder: randomizedQuestions.map((q) => q.id),
                nextProgress
            });
            setUser(response.data.user); // Update user with new progress
        } catch (error) {
            console.error("Error submitting test:", error);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-10 font-sans">
            <Breadcrumb currentStep="pretest" />

            <h1 className="text-2xl font-bold text-gray-800 mb-1">Microeconomics Pre-Test</h1>
            <p className="text-sm text-gray-500 mb-6">
                First, we would like to test your knowledge on some basic microeconomics concepts.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
                {randomizedQuestions.map((q, idx) => (
                    <div key={q.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                            Question {idx + 1}
                        </p>
                        <p className="text-base font-semibold text-gray-800 mb-4 leading-snug">{q.text}</p>
                        <div className="space-y-2">
                            {Object.entries(q.options).map(([key, value]) => (
                                <label
                                    key={key}
                                    className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all duration-150 ${
                                        answers[q.id] === key
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name={q.id}
                                        value={key}
                                        checked={answers[q.id] === key}
                                        onChange={() => handleChange(q.id, key)}
                                        required
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 text-left"
                                    />
                                    <span className="text-left text-sm text-gray-700 leading-relaxed">{value}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}

                <button
                    type="submit"
                    className="w-full py-3 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-700 transition-colors duration-150"
                >
                    Submit Test
                </button>
            </form>
        </div>
    );
};

export default TestOne;
