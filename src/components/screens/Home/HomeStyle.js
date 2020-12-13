import styled from 'styled-components/native';

export const LoginCardContainer = styled.View`
    padding: 30px 15px 15px;
    border-radius: ${props => props.theme.$mediumBorderRadius}px;
    text-align: center;
    background-color: white;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin-top: 10px;
    elevation: 10;
`;

export const SocialButtonsContainer = styled.View`
    margin-top: 15px;
    width: 100%;
`;
