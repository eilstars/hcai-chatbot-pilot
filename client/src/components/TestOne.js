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
        learningGoal: "Understand the characteristics of a scarce resource",
        explanation: "Scarcity occurs when limited resources (money, in this case) meet unlimited wants. The need to make a \"choice\" or \"trade-off\" is the direct result of scarcity.",
    },
    {
        id: 'q2',
        text: 'A rare element is discovered, and has important applications in healthcare. Its global supply is incredibly small and cannot be substantially increased. This situation best describes:',
        options: {
            a: 'A resource that experiences increasing demand.',
            b: 'A resource that is facing relative scarcity.',
            c: 'A resource that is subject to absolute scarcity.',
            d: 'A resource that has multiple alternative uses.'
        },
        answer: 'c',
        learningGoal: 'Understand the difference between absolute and relative scarcity ',
        explanation: 'Absolute scarcity occurs when the total quantity of a resource is naturally limited and cannot be increased, regardless of demand or price.'
    },
    {
        id: 'q3',
        text: 'A farmer uses water when growing his crops. Which factor of production can it be categorized as?',
        options: {
            a: 'Capital.',
            b: 'Labor.',
            c: 'Land.',
            d: 'Entrepreneurship.'
        },
        answer: 'c',
        learningGoal: 'Understand the factors of production, and their applications',
        explanation: '"Land" encompasses all natural resources used in production that are not man-made.'
    },
    {
        id: 'q4',
        text: 'You have $30. Instead of going bowling with friends, you decide to buy food. What is the opportunity cost of getting the food?',
        options: {
            a: 'The enjoyment of hanging out with friends.',
            b: 'The $30 the food cost.',
            c: 'The price of bowling.',
            d: 'The time it took to eat the food.'
        },
        answer: 'a',
        learningGoal: 'Understand what an opportunity cost is, and how to apply it',
        explanation: 'Opportunity cost is the value of the next best alternative foregone. If you choose dinner, you give up the entire subjective value you placed on the bowling experience ($35).'
    },
    {
        id: 'q5',
        text: "A small town decides to install new, bright streetlights along all its main roads. Once these streetlights are on, it's impossible to stop any resident or visitor from benefiting from the added light at night. Based on these features, the streetlight service is best described as:",
        options: {
            a: 'Private good, because the town had to pay for them.',
            b: 'Public good, because everyone benefits from the lights.',
            c: 'Private good, because only the people living in that specific town can use them.',
            d: 'Public good, because the lights are very expensive to install and maintain.'
        },
        answer: 'b',
        learningGoal: 'Identify the difference between a public and private good',
        explanation: "Streetlights are non-excludable and non-rival, meaning everyone can benefit without reducing others' use."
    },
    {
        id: 'q6',
        text: "You decide to quit a job paying $50,000 a year to start a bookstore. This past year you had a total sales revenue of $200,000. Your direct expenses for books, rent, and employee salaries (explicit costs) amounted to $130,000. What is the bookstore's accounting profit for last year?",
        options: {
            a: '$200,000',
            b: '$330,000',
            c: '$70,000',
            d: '$130,000'
        },
        answer: 'c',
        learningGoal: 'Understand accounting vs economic profit',
        explanation: 'Accounting profit equals revenue minus explicit costs only: $200,000 − $130,000 = $70,000.'
    },
    {
        id: 'q7',
        text: 'Why might someone decide to buy tickets to a specific concert, even if other forms of entertainment are available for less money?',
        options: {
            a: 'Because they want to help the musicians earn a lot of money.',
            b: 'Because they expect to have a unique and enjoyable experience at that particular concert.',
            c: 'Because they believe all concerts are equally good.',
            d: 'Because they want to spend all their extra money quickly.'
        },
        answer: 'b',
        learningGoal: 'Understand the definition of utility',
        explanation: 'Utility is the subjective satisfaction or benefit a consumer derives from consuming a good or service.'
    },
    {
        id: 'q8',
        text: 'A student has already spent 4 hours studying for a Macroeconomics exam, and believes she will get an 82%. She calculates that studying for a 5th hour will increase her score to 88%, but she\'d have to skip a cooking class that cost $25. Her average study time per exam this semester is 3 hours. To make a rational decision regarding that 5th hour, which of the following represents the correct marginal comparison?',
        options: {
            a: 'The 6% increase in the exam grade versus the $25 opportunity cost of the cooking class.',
            b: 'The 88% projected total grade versus the 4 hours of effort already invested.',
            c: 'The marginal gain of 6% versus the average utility of 3 hours of study time.',
            d: 'The total tuition cost per credit hour versus the potential increase in lifetime earnings from an 88% grade.'
        },
        answer: 'a',
        learningGoal: 'Explain how rational decisions are made by comparing marginal benefits',
        explanation: 'This identifies the marginal benefit (the specific change in utility/grade from the next unit of input) and weighs it against the marginal cost (the value of the next best alternative foregone).'
    },
    {
        id: 'q9',
        text: "You decide to leave your corporate job, where you earned $85,000 a year, to start your own independent software consultancy. In your first year, you brought in $210,000 in total revenue. Your business expenses (office rent, software licenses, and hardware) totaled $95,000. What is the consultancy's economic profit for the first year?",
        options: {
            a: '$210,000',
            b: '$115,000',
            c: '$30,000',
            d: '$180,000'
        },
        answer: 'c',
        learningGoal: 'Understand accounting vs economic profit',
        explanation: 'Economic profit subtracts both explicit costs ($95,000) and implicit costs ($85,000) from total revenue.'
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
            return [...baseQuestions, attentionCheckQuestion];
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
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700 leading-relaxed">{value}</span>
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
