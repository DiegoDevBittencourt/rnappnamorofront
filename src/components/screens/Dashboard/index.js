import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-community/async-storage';

import * as Actions from '../../../actions';
import { decodeJwtToken } from '../../utils/Functions';
import { DashboardContainer } from './DashboardStyle';
import MobileDashboard from './MobileDashboard';

export default function Dashboard(props) {

    const dispatch = useDispatch();

    const { isAuthenticated, checkingIfTokenHasExpired } = useSelector(state => state.auth);
    const { userData } = useSelector(state => state.dashboard);

    useEffect(() => {
        handleAccessToken();
    }, []);

    const handleAccessToken = async () => {

        const accessToken = await AsyncStorage.getItem('accessToken');

        //needs the id to be used when download data from resource server:
        dispatch(Actions.updateUserDataOnRedux({ ...userData, id: decodeJwtToken(accessToken).id }));
        dispatch(Actions.updateAccessTokenOnRedux(accessToken));
        dispatch(Actions.checkIfTokenHasExpired());
    }

    useEffect(() => {

        !checkingIfTokenHasExpired && isAuthenticated ?
            dispatch(Actions.getUserData(true, true, true, true))
            : !checkingIfTokenHasExpired && !isAuthenticated && props.navigation.push('Home');

    }, [isAuthenticated, checkingIfTokenHasExpired]);

    return (
        <DashboardContainer>
            <MobileDashboard />
        </DashboardContainer>
    )
}
