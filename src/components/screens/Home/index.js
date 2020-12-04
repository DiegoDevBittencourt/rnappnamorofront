import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import logo from '../../../assets/logo.png';
import appBackgroundOpaque from '../../../assets/appBackgroundOpaque.jpg';
import { ImageBackgroundContainer } from '../../../GlobalStyle';
import { Loader, BigLogo } from '../../commonComponents';

import LoginCard from './Components/LoginCard';
import * as Actions from '../../../actions';

export default function Home(props) {

    const dispatch = useDispatch();

    const { isAuthenticated } = useSelector(state => state.auth);
    const { showLoader } = useSelector(state => state.utils);

    useEffect(() => {
        //dispatch(Actions.checkIfTokenHasExpired());
    }, []);

    useEffect(() => {
        isAuthenticated && props.navigation.push('Dashboard');
    }, [isAuthenticated]);

    return (
        <ImageBackgroundContainer source={appBackgroundOpaque}>

            {showLoader && <Loader />}

            <BigLogo source={logo} />

            <LoginCard {...props} />

        </ImageBackgroundContainer>
    )
}
