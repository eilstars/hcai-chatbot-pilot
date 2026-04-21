import React, { useContext } from 'react';
import { UserContext } from '../context/UserContext';

// Import all components
import ParticipantLogin from './ParticipantLogin';
import ConsentForm from './ConsentForm';
import PreSurvey from './PreSurvey';
import MicroeconomicsTest from './TestOne';
import ChatPhaseLayout from './ChatPhaseLayout';
import ChatbotIntro from './ChatbotIntro';
import PostStudySurvey from './PostStudySurvey';
import DemographicsSurvey from './DemographicsSurvey';
import StudyComplete from './StudyComplete';

const MainStudyComponent = () => {
  const { user } = useContext(UserContext);

  if (!user) {
    return <ParticipantLogin />;
  }

  switch (user.progress) {
    case 'consent':
      return <ConsentForm />;
    case 'pre-survey':
      return <PreSurvey nextProgress="pretest" />;

    case 'pretest':
      return <MicroeconomicsTest testType="pretest" nextProgress="chat-intro" />;
    case 'chat-intro':
      return <ChatbotIntro nextProgress="learning-1" />;
    case 'learning-1':
      return <ChatPhaseLayout
                round={1}
                preTestType="pretest"
                testTypeToSubmit="learning-session"
                nextProgress="post-survey"
             />;

    case 'post-survey':
      return <PostStudySurvey nextProgress="demographics" />;
    case 'demographics':
      return <DemographicsSurvey nextProgress="completed" />;
    case 'completed':
      return <StudyComplete />;

    default:
      return <h2>Loading...</h2>;
  }
};

export default MainStudyComponent;