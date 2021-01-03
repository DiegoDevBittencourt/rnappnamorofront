import React from 'react';
import styled from 'styled-components/native';

import appIcon from '../../assets/appIcon.png'
import { GenericRowView, P } from '../../GlobalStyle';

const AppVersionContainer = styled(GenericRowView)`
    width: 100%;
    align-items: center;
    justify-content: center;
    flex-direction: column;
`;

const AppIcon = styled.Image`
    height: 30px;
    width: 30px;
`;

export default AppVersion = () => {
    return <AppVersionContainer>

        <AppIcon source={appIcon} />

        <P style={{ padding: 5 }}>{'Versão 1.0.0'}</P>

    </AppVersionContainer>
}
